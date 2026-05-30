"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, MousePointerClick, RotateCcw, Scan } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { loadImageElement } from "@/lib/image";
import {
  buildAnalysisCanvas,
  detectMaskAtPoint,
} from "@/lib/maskDetection";
import { usePosterStore } from "@/lib/store";
import type { DetectedMask, TemplateAsset } from "@/lib/types";

type Analysis = ReturnType<typeof buildAnalysisCanvas>;

export function Step1Template() {
  const template = usePosterStore((s) => s.template);
  const mask = usePosterStore((s) => s.mask);
  const setTemplate = usePosterStore((s) => s.setTemplate);
  const setMask = usePosterStore((s) => s.setMask);
  const setStep = usePosterStore((s) => s.setStep);

  const imgRef = useRef<HTMLImageElement>(null);
  const analysisRef = useRef<Analysis | null>(null);
  const [rendered, setRendered] = useState({ width: 0, height: 0 });
  const [tolerance, setTolerance] = useState(48);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Build (or rebuild) the downscaled analysis bitmap when the template changes.
  useEffect(() => {
    analysisRef.current = null;
    if (!template) return;
    let alive = true;
    loadImageElement(template.url)
      .then((img) => {
        if (!alive) return;
        analysisRef.current = buildAnalysisCanvas(
          img,
          template.naturalWidth,
          template.naturalHeight,
        );
      })
      .catch(() => setHint("Could not analyze the template image."));
    return () => {
      alive = false;
    };
  }, [template]);

  // Track the on-screen render size so the wireframe overlay stays aligned.
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const measure = () =>
      setRendered({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [template]);

  const handleTemplateFile = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setBusy(true);
      setHint(null);
      try {
        const url = URL.createObjectURL(file);
        const img = await loadImageElement(url);
        const asset: TemplateAsset = {
          file,
          url,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };
        setTemplate(asset);
        setMask(null);
        setHint("Click inside the dark placeholder zone to auto-detect it.");
      } catch {
        setHint("That file could not be loaded as an image.");
      } finally {
        setBusy(false);
      }
    },
    [setTemplate, setMask],
  );

  const runDetection = useCallback(
    (clientX: number, clientY: number) => {
      const el = imgRef.current;
      const analysis = analysisRef.current;
      if (!el || !analysis || !template) return;
      const rect = el.getBoundingClientRect();
      const scaleX = template.naturalWidth / rect.width;
      const scaleY = template.naturalHeight / rect.height;
      const naturalX = (clientX - rect.left) * scaleX;
      const naturalY = (clientY - rect.top) * scaleY;

      const result = detectMaskAtPoint(analysis, naturalX, naturalY, tolerance);
      if (!result) {
        setHint("No region found there — try clicking deeper inside the zone.");
        return;
      }
      if (result.fillRatio < 0.45) {
        setHint(
          "Region looks irregular. Adjust the tolerance slider and click again for a cleaner box.",
        );
      } else {
        setHint(null);
      }
      setMask(result.mask);
    },
    [template, tolerance, setMask],
  );

  return (
    <section className="space-y-5">
      <Header
        index={1}
        title="Base template & smart zone detection"
        subtitle="Upload the master poster, then click the dark placeholder to trace its exact bounding box and corner radii."
      />

      {!template ? (
        <Dropzone
          onFiles={handleTemplateFile}
          disabled={busy}
          className="min-h-[260px] px-6 py-12"
        >
          <ImageUp className="mb-3 h-10 w-10 text-brand-400" />
          <p className="text-base font-medium text-slate-200">
            Drag &amp; drop your master poster
          </p>
          <p className="mt-1 text-sm text-slate-400">
            or click to browse — PNG / JPG / WEBP, any resolution
          </p>
        </Dropzone>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* Interactive template canvas with wireframe overlay */}
          <div className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
            <div className="relative inline-block max-w-full leading-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={template.url}
                alt="Poster template"
                onClick={(e) => runDetection(e.clientX, e.clientY)}
                className="block max-h-[70vh] w-full max-w-full cursor-crosshair select-none object-contain"
                draggable={false}
              />
              {mask && rendered.width > 0 && (
                <Wireframe
                  mask={mask}
                  natural={{
                    width: template.naturalWidth,
                    height: template.naturalHeight,
                  }}
                  rendered={rendered}
                />
              )}
            </div>
          </div>

          {/* Controls / readout */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <MousePointerClick className="h-4 w-4 text-brand-400" />
                Detection tolerance
              </div>
              <input
                type="range"
                min={12}
                max={120}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Strict</span>
                <span>{tolerance}</span>
                <span>Loose</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Higher tolerance merges more shades into one zone. Click the
                placeholder again after adjusting.
              </p>
            </div>

            <DetectionReadout mask={mask} />

            {hint && (
              <p className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-300">
                {hint}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTemplate(null);
                  setMask(null);
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-ink-700"
              >
                <RotateCcw className="h-4 w-4" /> Replace
              </button>
              <button
                type="button"
                disabled={!mask}
                onClick={() => setStep(2)}
                className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition enabled:hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Scan className="h-4 w-4" /> Continue
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function Wireframe({
  mask,
  natural,
  rendered,
}: {
  mask: DetectedMask;
  natural: { width: number; height: number };
  rendered: { width: number; height: number };
}) {
  const sx = rendered.width / natural.width;
  const sy = rendered.height / natural.height;
  return (
    <div
      className="pointer-events-none absolute animate-fade-in border-2 border-brand-400 shadow-[0_0_0_9999px_rgba(10,10,15,0.45)]"
      style={{
        left: mask.x * sx,
        top: mask.y * sy,
        width: mask.width * sx,
        height: mask.height * sy,
        borderTopLeftRadius: mask.radii.tl * sx,
        borderTopRightRadius: mask.radii.tr * sx,
        borderBottomRightRadius: mask.radii.br * sx,
        borderBottomLeftRadius: mask.radii.bl * sx,
      }}
    >
      <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {Math.round(mask.width)} × {Math.round(mask.height)} px
      </span>
    </div>
  );
}

function DetectionReadout({ mask }: { mask: DetectedMask | null }) {
  if (!mask) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-sm text-slate-400">
        No zone detected yet.
      </div>
    );
  }
  const r = mask.radii;
  return (
    <div className="space-y-2 rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-sm">
      <p className="font-medium text-slate-200">Detected zone (natural px)</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
        <Stat label="X" value={Math.round(mask.x)} />
        <Stat label="Y" value={Math.round(mask.y)} />
        <Stat label="W" value={Math.round(mask.width)} />
        <Stat label="H" value={Math.round(mask.height)} />
      </dl>
      <p className="pt-1 text-xs text-slate-400">
        Corners:{" "}
        <span className="font-medium text-brand-300">
          {mask.uniform ? "uniform" : "asymmetric"}
        </span>{" "}
        ({Math.round(r.tl)}/{Math.round(r.tr)}/{Math.round(r.br)}/
        {Math.round(r.bl)})
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between rounded bg-ink-800/60 px-2 py-1">
      <dt>{label}</dt>
      <dd className="font-mono text-slate-200">{value}</dd>
    </div>
  );
}

export function Header({
  index,
  title,
  subtitle,
}: {
  index: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-300">
        {index}
      </span>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}
