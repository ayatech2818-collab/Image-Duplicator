"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Library,
  Loader2,
  Pencil,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { deleteTemplate, getAllTemplates, type StoredTemplate } from "@/lib/db";
import { usePosterStore } from "@/lib/store";
import type { TemplateAsset } from "@/lib/types";

interface LibraryCard {
  record: StoredTemplate;
  thumbUrl: string;
}

interface LibraryPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Admin dashboard for the persistent template library. Lists every saved
 * template with its calibrated zone and offers Reuse (jump straight into the
 * photo pipeline), Edit (reopen in the calibration workspace), and Delete.
 */
export function LibraryPanel({ open, onClose }: LibraryPanelProps) {
  const applyTemplate = usePosterStore((s) => s.applyTemplate);

  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  const releaseUrls = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await getAllTemplates();
      releaseUrls();
      const next = records.map((record) => {
        const thumbUrl = URL.createObjectURL(record.blob);
        urlsRef.current.push(thumbUrl);
        return { record, thumbUrl };
      });
      setCards(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the library.");
    } finally {
      setLoading(false);
    }
  }, [releaseUrls]);

  // Load when opened; release object URLs when closed/unmounted.
  useEffect(() => {
    if (open) void refresh();
    return () => {
      if (!open) releaseUrls();
    };
  }, [open, refresh, releaseUrls]);

  useEffect(() => releaseUrls, [releaseUrls]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const loadInto = useCallback(
    (record: StoredTemplate, step: 1 | 2) => {
      const file = new File([record.blob], record.name || "template", {
        type: record.mimeType,
      });
      const asset: TemplateAsset = {
        file,
        url: URL.createObjectURL(record.blob),
        naturalWidth: record.naturalWidth,
        naturalHeight: record.naturalHeight,
        sourceId: record.id,
        name: record.name,
      };
      applyTemplate(asset, record.mask, step);
      onClose();
    },
    [applyTemplate, onClose],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this saved template? This cannot be undone.")) return;
      setBusyId(id);
      try {
        await deleteTemplate(id);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-4xl animate-fade-in rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Library className="h-5 w-5 text-brand-400" />
            <h2 className="text-base font-semibold text-white">Template library</h2>
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">
              {cards.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close library"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-ink-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {error && (
            <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading saved templates…
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Library className="h-10 w-10 text-ink-700" />
              <p className="text-sm font-medium text-slate-300">No saved templates yet</p>
              <p className="max-w-xs text-xs text-slate-500">
                Calibrate a template in step 1 and click “Save to library” to keep it
                permanently for reuse across sessions.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {cards.map(({ record, thumbUrl }) => (
                <li
                  key={record.id}
                  className="group overflow-hidden rounded-xl border border-ink-700 bg-ink-950"
                >
                  <div
                    className="relative w-full bg-ink-900"
                    style={{ aspectRatio: `${record.naturalWidth} / ${record.naturalHeight}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbUrl}
                      alt={record.name}
                      className="h-full w-full object-contain"
                    />
                    {/* Calibrated zone preview */}
                    <span
                      className="pointer-events-none absolute border border-brand-400/80 bg-brand-400/10"
                      style={zonePreviewStyle(record)}
                    />
                  </div>
                  <div className="space-y-2 p-2.5">
                    <p className="truncate text-xs font-medium text-slate-200" title={record.name}>
                      {record.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {record.naturalWidth}×{record.naturalHeight} ·{" "}
                      {record.mask.uniform ? "uniform" : "asymmetric"} corners
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => loadInto(record, 2)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-brand-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-500"
                      >
                        <Play className="h-3 w-3" /> Reuse
                      </button>
                      <button
                        type="button"
                        onClick={() => loadInto(record, 1)}
                        aria-label="Edit calibration"
                        className="inline-flex items-center justify-center rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-slate-300 transition hover:bg-ink-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(record.id)}
                        disabled={busyId === record.id}
                        aria-label="Delete template"
                        className="inline-flex items-center justify-center rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        {busyId === record.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Position the zone-preview rectangle as a percentage of the template bounds. */
function zonePreviewStyle(record: StoredTemplate): React.CSSProperties {
  const { mask, naturalWidth, naturalHeight } = record;
  return {
    left: `${(mask.x / naturalWidth) * 100}%`,
    top: `${(mask.y / naturalHeight) * 100}%`,
    width: `${(mask.width / naturalWidth) * 100}%`,
    height: `${(mask.height / naturalHeight) * 100}%`,
  };
}
