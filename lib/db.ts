/**
 * Persistent template library backed by IndexedDB.
 *
 * Each saved template keeps the *raw* high-resolution base image (as a Blob, so
 * there is zero quality loss and no base64 bloat) alongside the calibrated
 * placement metadata (the DetectedMask). Records survive across sessions and
 * are loaded straight back into the processing pipeline or calibration
 * workspace. No external dependency — a thin, strongly-typed wrapper over the
 * native IndexedDB API.
 */

import type { DetectedMask } from "./types";

const DB_NAME = "poster-forge";
const DB_VERSION = 1;
const STORE = "templates";

/** A persisted template entry. */
export interface StoredTemplate {
  id: string;
  name: string;
  /** Raw source image bytes, losslessly preserved. */
  blob: Blob;
  mimeType: string;
  naturalWidth: number;
  naturalHeight: number;
  /** Calibrated placement metadata, in natural pixel space. */
  mask: DetectedMask;
  createdAt: number;
  updatedAt: number;
}

/** Lightweight projection used by the library grid (no heavy Blob payload kept in lists). */
export type StoredTemplateMeta = Omit<StoredTemplate, "blob">;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB is unavailable in this environment."));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // If another tab triggers an upgrade, close this handle so it doesn't block.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open the template database."));
    request.onblocked = () =>
      reject(new Error("Database upgrade blocked by another open tab."));
  });

  return dbPromise;
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

/** Insert or replace a template record. */
export async function putTemplate(record: StoredTemplate): Promise<void> {
  const db = await openDb();
  await promisifyRequest(tx(db, "readwrite").put(record));
}

/** Fetch a single full template (including its Blob) by id. */
export async function getTemplate(id: string): Promise<StoredTemplate | undefined> {
  const db = await openDb();
  return promisifyRequest<StoredTemplate | undefined>(tx(db, "readonly").get(id));
}

/** List all stored templates (metadata only), newest first. */
export async function listTemplateMeta(): Promise<StoredTemplateMeta[]> {
  const db = await openDb();
  const all = await promisifyRequest<StoredTemplate[]>(tx(db, "readonly").getAll());
  return all
    .map(({ blob: _blob, ...meta }) => meta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Fetch every stored template (including Blobs), newest first. */
export async function getAllTemplates(): Promise<StoredTemplate[]> {
  const db = await openDb();
  const all = await promisifyRequest<StoredTemplate[]>(tx(db, "readonly").getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Delete a template by id. */
export async function deleteTemplate(id: string): Promise<void> {
  const db = await openDb();
  await promisifyRequest(tx(db, "readwrite").delete(id));
}

/** Remove every stored template. */
export async function clearTemplates(): Promise<void> {
  const db = await openDb();
  await promisifyRequest(tx(db, "readwrite").clear());
}
