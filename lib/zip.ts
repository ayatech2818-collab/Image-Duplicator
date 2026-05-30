/** Bundle generated poster blobs into a single ZIP, entirely client-side. */

import JSZip from "jszip";
import { saveAs } from "file-saver";

export interface ZipEntry {
  blob: Blob;
  /** Original upload name, used to derive a friendly file name. */
  sourceName: string;
}

function baseName(name: string): string {
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const trimmed = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = trimmed.lastIndexOf(".");
  return (dot > 0 ? trimmed.slice(0, dot) : trimmed) || "photo";
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/**
 * Build and download a ZIP of sequentially-numbered posters.
 * Returns the generated archive name.
 */
export async function exportPostersZip(
  entries: readonly ZipEntry[],
  options: { fileName?: string; onProgress?: (percent: number) => void } = {},
): Promise<string> {
  if (entries.length === 0) {
    throw new Error("No posters to export.");
  }

  const zip = new JSZip();
  const width = String(entries.length).length;

  entries.forEach((entry, i) => {
    const name = `poster_${pad(i + 1, Math.max(2, width))}_${baseName(
      entry.sourceName,
    )}.jpg`;
    zip.file(name, entry.blob);
  });

  const archive = await zip.generateAsync(
    { type: "blob", compression: "STORE" },
    (meta) => options.onProgress?.(meta.percent),
  );

  const fileName =
    options.fileName ?? `posters_${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(archive, fileName);
  return fileName;
}
