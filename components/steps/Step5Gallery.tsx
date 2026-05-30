"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Download, FileArchive, RefreshCw } from "lucide-react";
import { saveAs } from "file-saver";
import { Header } from "@/components/steps/Step1Template";
import { exportPostersZip } from "@/lib/zip";
import { usePosterStore } from "@/lib/store";

export function Step5Gallery() {
  const photos = usePosterStore((s) => s.photos);
  const setStep = usePosterStore((s) => s.setStep);
  const resetSession = usePosterStore((s) => s.resetSession);

  const [zipping, setZipping] = useState(false);
  const [zipPercent, setZipPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const done = useMemo(() => photos.filter((p) => p.status === "done"), [photos]);
  const failed = useMemo(
    () => photos.filter((p) => p.status === "error"),
    [photos],
  );

  const downloadOne = useCallback((blob: Blob, name: string) => {
    const base = name.replace(/\.[^.]+$/, "") || "poster";
    saveAs(blob, `${base}_poster.jpg`);
  }, []);

  const downloadZip = useCallback(async () => {
    if (done.length === 0 || zipping) return;
    setZipping(true);
    setZipPercent(0);
    setError(null);
    try {
      await exportPostersZip(
        done.map((p) => ({ blob: p.resultBlob as Blob, sourceName: p.file.name })),
        { onProgress: (pct) => setZipPercent(Math.round(pct)) },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "ZIP export failed.");
    } finally {
      setZipping(false);
    }
  }, [done, zipping]);

  return (
    <section className="space-y-5">
      <Header
        index={5}
        title="Finished posters & export"
        subtitle="Download posters individually, or bundle every full-resolution image into one ZIP — all in your browser."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{done.length}</span> ready
          {failed.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {failed.length} failed
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep(4)}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-ink-700"
          >
            <RefreshCw className="h-4 w-4" /> Re-generate
          </button>
          <button
            type="button"
            onClick={downloadZip}
            disabled={done.length === 0 || zipping}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileArchive className="h-4 w-4" />
            {zipping ? `Zipping… ${zipPercent}%` : "Download all as ZIP"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <li
            key={p.id}
            className="group relative overflow-hidden rounded-xl border border-ink-700 bg-ink-950"
          >
            {p.status === "done" && p.resultUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.resultUrl}
                  alt={`Poster for ${p.file.name}`}
                  className="aspect-[3/4] w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() =>
                    p.resultBlob && downloadOne(p.resultBlob, p.file.name)
                  }
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-ink-950/85 py-2 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
              </>
            ) : (
              <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 p-3 text-center">
                {p.status === "error" ? (
                  <AlertTriangle className="h-6 w-6 text-rose-400" />
                ) : (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-700 border-t-brand-400" />
                )}
                <span className="text-[11px] text-slate-500">
                  {p.status === "error" ? p.error ?? "Failed" : "Pending…"}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Start a new session? This clears the template, photos, and generated posters.",
              )
            ) {
              resetSession();
            }
          }}
          className="text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline"
        >
          Start a new session
        </button>
      </div>
    </section>
  );
}
