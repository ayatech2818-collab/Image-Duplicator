"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { CompositeCanvas } from "@/components/ui/CompositeCanvas";
import { Header } from "@/components/steps/Step1Template";
import { AdjustModal } from "@/components/steps/AdjustModal";
import { usePosterStore } from "@/lib/store";
import { DEFAULT_ADJUSTMENT } from "@/lib/types";

export function Step3Adjust() {
  const template = usePosterStore((s) => s.template);
  const mask = usePosterStore((s) => s.mask);
  const photos = usePosterStore((s) => s.photos);
  const fitMode = usePosterStore((s) => s.fitMode);
  const setStep = usePosterStore((s) => s.setStep);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activePhoto = photos.find((p) => p.id === activeId) ?? null;

  if (!template || !mask) {
    return (
      <p className="text-sm text-slate-400">
        Complete steps 1 and 2 first.
      </p>
    );
  }

  return (
    <section className="space-y-5">
      <Header
        index={3}
        title="Review & fine-tune framing"
        subtitle="Each photo is previewed inside the detected zone. Click any that need centering to nudge zoom and position."
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => {
          const tweaked =
            p.adjustment.zoom !== DEFAULT_ADJUSTMENT.zoom ||
            p.adjustment.offsetX !== DEFAULT_ADJUSTMENT.offsetX ||
            p.adjustment.offsetY !== DEFAULT_ADJUSTMENT.offsetY;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setActiveId(p.id)}
                className="group block w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-950 transition hover:border-brand-500/60"
              >
                <div className="flex items-center justify-center p-2">
                  <CompositeCanvas
                    templateUrl={template.url}
                    templateWidth={template.naturalWidth}
                    templateHeight={template.naturalHeight}
                    photoUrl={p.url}
                    mask={mask}
                    mode={fitMode}
                    adjustment={p.adjustment}
                    maxEdge={300}
                  />
                </div>
                <div className="flex items-center justify-between border-t border-ink-700 px-2.5 py-1.5">
                  <span className="truncate text-[11px] text-slate-400">
                    {p.file.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 group-hover:text-brand-300">
                    {tweaked ? (
                      <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-brand-300">
                        edited
                      </span>
                    ) : (
                      <SlidersHorizontal className="h-3 w-3" />
                    )}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-ink-700"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep(4)}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
        >
          Continue to generate
        </button>
      </div>

      {activePhoto && (
        <AdjustModal
          photo={activePhoto}
          template={template}
          onClose={() => setActiveId(null)}
        />
      )}
    </section>
  );
}
