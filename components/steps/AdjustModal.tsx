"use client";

import { useEffect } from "react";
import { RotateCcw, X, ZoomIn } from "lucide-react";
import { CompositeCanvas } from "@/components/ui/CompositeCanvas";
import { usePosterStore } from "@/lib/store";
import type { PhotoItem, TemplateAsset } from "@/lib/types";

interface AdjustModalProps {
  photo: PhotoItem;
  template: TemplateAsset;
  onClose: () => void;
}

export function AdjustModal({ photo, template, onClose }: AdjustModalProps) {
  const mask = usePosterStore((s) => s.mask);
  const fitMode = usePosterStore((s) => s.fitMode);
  const updateAdjustment = usePosterStore((s) => s.updateAdjustment);
  const resetAdjustment = usePosterStore((s) => s.resetAdjustment);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mask) return null;
  const adj = photo.adjustment;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">
              {photo.file.name}
            </h3>
            <p className="text-xs text-slate-500">
              {photo.naturalWidth} × {photo.naturalHeight} px · {fitMode === "smart" ? "Smart Fit" : "Fill Frame"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-ink-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_240px]">
          <div className="flex items-center justify-center rounded-xl bg-ink-950 p-3">
            <CompositeCanvas
              templateUrl={template.url}
              templateWidth={template.naturalWidth}
              templateHeight={template.naturalHeight}
              photoUrl={photo.url}
              mask={mask}
              mode={fitMode}
              adjustment={adj}
              maxEdge={460}
            />
          </div>

          <div className="space-y-5">
            <Slider
              label="Zoom"
              icon={<ZoomIn className="h-3.5 w-3.5" />}
              min={0.5}
              max={3}
              step={0.01}
              value={adj.zoom}
              display={`${adj.zoom.toFixed(2)}×`}
              onChange={(zoom) => updateAdjustment(photo.id, { zoom })}
            />
            <Slider
              label="Position X"
              min={-0.5}
              max={0.5}
              step={0.005}
              value={adj.offsetX}
              display={`${Math.round(adj.offsetX * 100)}%`}
              onChange={(offsetX) => updateAdjustment(photo.id, { offsetX })}
            />
            <Slider
              label="Position Y"
              min={-0.5}
              max={0.5}
              step={0.005}
              value={adj.offsetY}
              display={`${Math.round(adj.offsetY * 100)}%`}
              onChange={(offsetY) => updateAdjustment(photo.id, { offsetY })}
            />

            <button
              type="button"
              onClick={() => resetAdjustment(photo.id)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-ink-700"
            >
              <RotateCcw className="h-4 w-4" /> Reset to auto
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  icon,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  icon?: React.ReactNode;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="font-mono text-slate-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
