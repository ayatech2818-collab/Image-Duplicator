"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Header } from "@/components/steps/Step1Template";
import { composePoster, prepareTemplate } from "@/lib/composition";
import { runConcurrent } from "@/lib/queue";
import { usePosterStore } from "@/lib/store";

const CONCURRENCY = 3;

export function Step4Generate() {
  const template = usePosterStore((s) => s.template);
  const mask = usePosterStore((s) => s.mask);
  const photos = usePosterStore((s) => s.photos);
  const fitMode = usePosterStore((s) => s.fitMode);
  const generation = usePosterStore((s) => s.generation);
  const beginGeneration = usePosterStore((s) => s.beginGeneration);
  const markPhotoStatus = usePosterStore((s) => s.markPhotoStatus);
  const tickGeneration = usePosterStore((s) => s.tickGeneration);
  const endGeneration = usePosterStore((s) => s.endGeneration);
  const setStep = usePosterStore((s) => s.setStep);

  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const generateAll = useCallback(async () => {
    if (runningRef.current || !template || !mask) return;
    runningRef.current = true;
    setError(null);

    // Snapshot the items to process before status mutations.
    const items = usePosterStore.getState().photos;
    beginGeneration(items.length);

    try {
      const prepared = await prepareTemplate(template);

      await runConcurrent(
        items,
        async (photo) => {
          markPhotoStatus(photo.id, { status: "processing" });
          try {
            const blob = await composePoster(
              prepared,
              photo.file,
              mask,
              fitMode,
              photo.adjustment,
            );
            const resultUrl = URL.createObjectURL(blob);
            markPhotoStatus(photo.id, {
              status: "done",
              resultBlob: blob,
              resultUrl,
            });
          } catch (err) {
            markPhotoStatus(photo.id, {
              status: "error",
              error: err instanceof Error ? err.message : "Render failed",
            });
          } finally {
            tickGeneration();
          }
        },
        CONCURRENCY,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      endGeneration();
      runningRef.current = false;
      // Jump to the gallery if at least one poster rendered.
      const anyDone = usePosterStore
        .getState()
        .photos.some((p) => p.status === "done");
      if (anyDone) setStep(5);
    }
  }, [
    template,
    mask,
    fitMode,
    beginGeneration,
    markPhotoStatus,
    tickGeneration,
    endGeneration,
    setStep,
  ]);

  const { running, completed, total } = generation;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section className="space-y-6">
      <Header
        index={4}
        title="Generate the full batch"
        subtitle={`Posters render off-screen at native template resolution (${template?.naturalWidth ?? 0}×${template?.naturalHeight ?? 0}), ${CONCURRENCY} at a time, then export as 0.95-quality JPEG.`}
      />

      <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <p className="text-sm text-slate-400">
            <span className="text-2xl font-bold text-white">{photos.length}</span>
            <br />
            poster{photos.length === 1 ? "" : "s"} queued ·{" "}
            {fitMode === "smart" ? "Smart Fit" : "Fill Frame"}
          </p>

          <button
            type="button"
            onClick={generateAll}
            disabled={running || photos.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition enabled:hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing {completed} of {total}…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate all posters
              </>
            )}
          </button>

          {(running || completed > 0) && (
            <div className="w-full max-w-md">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {running
                  ? `Processing ${completed} of ${total}… (${percent}%)`
                  : `Completed ${completed} of ${total}.`}
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(3)}
          disabled={running}
          className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-slate-300 transition enabled:hover:bg-ink-700 disabled:opacity-50"
        >
          Back
        </button>
        {completed > 0 && !running && (
          <button
            type="button"
            onClick={() => setStep(5)}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            View gallery
          </button>
        )}
      </div>
    </section>
  );
}
