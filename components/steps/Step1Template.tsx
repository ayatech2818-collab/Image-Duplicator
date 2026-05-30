"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Hand,
  ImageUp,
  Link2,
  Link2Off,
  MousePointerClick,
  Plus,
  RotateCcw,
  Save,
  Scan,
  Wand2,
} from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { ManualCalibrator } from "@/components/ui/ManualCalibrator";
import { loadImageElement, makeId } from "@/lib/image";
import {
  buildAnalysisCanvas,
  defaultManualMask,
  detectMaskAtPoint,
  normalizeMask,
} from "@/lib/maskDetection";
import { getTemplate, putTemplate } from "@/lib/db";
import { usePosterStore } from "@/lib/store";
import type {
  CalibrationMode,
  CornerRadii,
  DetectedMask,
  TemplateAsset,
} from "@/lib/types";

type Analysis = ReturnType<typeof buildAnalysisCanvas>;

/** The visible (object-contain) image rectangle within the <img> element box. */
interface DisplayRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function Step1Template() {
  const template = usePosterStore((s) => s.template);
  const mask = usePosterStore((s) => s.mask);
  const setTemplate = usePosterStore((s) => s.setTemplate);
  const applyTemplate = usePosterStore((s) => s.applyTemplate);
  const setMask = usePosterStore((s) => s.setMask);
  const setStep = usePosterStore((s) => s.setStep);

  const imgRef = useRef<HTMLImageElement>(null);
  const analysisRef = useRef<Analysis | null>(null);
  const [display, setDisplay] = useState<DisplayRect>({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [mode, setMode] = useState<CalibrationMode>("auto");
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

  // Track the on-screen size of the *visible* image (accounting for the
  // object-contain letterbox) so overlays stay pixel-aligned to the template.
  useEffect(() => {
    const el = imgRef.current;
    if (!el || !template) return;
    const ratio = template.naturalWidth / template.naturalHeight;
    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      let width = cw;
      let height = cw / ratio;
      if (height > ch) {
        height = ch;
        width = ch * ratio;
      }
      setDisplay({
        width,
        height,
        offsetX: (cw - width) / 2,
        offsetY: (ch - height) / 2,
      });
    };
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
        setMode("auto");
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
      // Map the click into the visible image rect, then into natural pixels.
      const localX = clientX - rect.left - display.offsetX;
      const localY = clientY - rect.top - display.offsetY;
      if (
        localX < 0 ||
        localY < 0 ||
        localX > display.width ||
        localY > display.height
      ) {
        return;
      }
      const naturalX = (localX / display.width) * template.naturalWidth;
      const naturalY = (localY / display.height) * template.naturalHeight;

      const result = detectMaskAtPoint(analysis, naturalX, naturalY, tolerance);
      if (!result) {
        setHint("No region found there — try clicking deeper inside the zone.");
        return;
      }
      if (result.fillRatio < 0.45) {
        setHint(
          "Region looks irregular. Adjust the tolerance slider and click again, or switch to Manual to draw it.",
        );
      } else {
        setHint(null);
      }
      setMask(result.mask);
    },
    [template, tolerance, display, setMask],
  );

  const updateMask = useCallback(
    (patch: Partial<DetectedMask>) => {
      if (!mask || !template) return;
      setMask(
        normalizeMask(
          { ...mask, ...patch },
          template.naturalWidth,
          template.naturalHeight,
        ),
      );
    },
    [mask, template, setMask],
  );

  if (!template) {
    return (
      <section className="space-y-5">
        <Header
          index={1}
          title="Base template & smart zone calibration"
          subtitle="Upload the master poster, then auto-detect or manually draw the placeholder zone."
        />
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
          <p className="mt-3 text-xs text-slate-500">
            Tip: open the Library to reuse a previously calibrated template.
          </p>
        </Dropzone>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <Header
        index={1}
        title="Base template & smart zone calibration"
        subtitle="Auto-detect the dark placeholder, or switch to Manual to draw and fine-tune the zone by hand."
      />

      <ModeToggle mode={mode} onChange={setMode} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Interactive template canvas with overlay */}
        <div className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <div className="relative inline-block w-full leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={template.url}
              alt="Poster template"
              onClick={
                mode === "auto"
                  ? (e) => runDetection(e.clientX, e.clientY)
                  : undefined
              }
              className={`block max-h-[70vh] w-full max-w-full select-none object-contain ${
                mode === "auto" ? "cursor-crosshair" : ""
              }`}
              draggable={false}
            />

            {/* Overlay layer, positioned over the visible image rect only.
                In auto mode it must not intercept clicks meant for the image
                (the wireframe inside is non-interactive); in manual mode the
                calibrator needs the pointer events. */}
            {display.width > 0 && (
              <div
                className={`absolute ${
                  mode === "auto" ? "pointer-events-none" : ""
                }`}
                style={{
                  left: display.offsetX,
                  top: display.offsetY,
                  width: display.width,
                  height: display.height,
                }}
              >
                {mode === "auto"
                  ? mask && (
                      <Wireframe
                        mask={mask}
                        natural={{
                          width: template.naturalWidth,
                          height: template.naturalHeight,
                        }}
                        rendered={display}
                      />
                    )
                  : (
                    <ManualCalibrator
                      mask={mask}
                      natural={{
                        width: template.naturalWidth,
                        height: template.naturalHeight,
                      }}
                      rendered={display}
                      onChange={setMask}
                    />
                  )}
              </div>
            )}
          </div>
        </div>

        {/* Controls / readout */}
        <aside className="space-y-4">
          {mode === "auto" ? (
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
          ) : (
            <ManualControls
              mask={mask}
              natural={{
                width: template.naturalWidth,
                height: template.naturalHeight,
              }}
              onUpdate={updateMask}
              onAddDefault={() =>
                setMask(
                  defaultManualMask(template.naturalWidth, template.naturalHeight),
                )
              }
            />
          )}

          {mode === "auto" ? (
            <DetectionReadout mask={mask} />
          ) : (
            <p className="rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-xs text-slate-400">
              Drag on the image to draw a new zone, drag the box to move it, or
              grab any handle to resize. Use the fields above for precise values.
            </p>
          )}

          {hint && (
            <p className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-300">
              {hint}
            </p>
          )}

          <SaveToLibrary
            template={template}
            mask={mask}
            onSaved={(asset) => applyTemplate(asset, mask as DetectedMask)}
          />

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
    </section>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: CalibrationMode;
  onChange: (mode: CalibrationMode) => void;
}) {
  const Btn = ({
    value,
    icon,
    label,
  }: {
    value: CalibrationMode;
    icon: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        mode === value
          ? "bg-brand-600 text-white shadow"
          : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="inline-flex w-full max-w-xs gap-1 rounded-xl border border-ink-700 bg-ink-900/60 p-1">
      <Btn value="auto" icon={<Wand2 className="h-4 w-4" />} label="Auto-detect" />
      <Btn value="manual" icon={<Hand className="h-4 w-4" />} label="Manual" />
    </div>
  );
}

function ManualControls({
  mask,
  natural,
  onUpdate,
  onAddDefault,
}: {
  mask: DetectedMask | null;
  natural: { width: number; height: number };
  onUpdate: (patch: Partial<DetectedMask>) => void;
  onAddDefault: () => void;
}) {
  const [linked, setLinked] = useState(true);

  if (!mask) {
    return (
      <div className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
        <p className="text-sm text-slate-300">No zone yet.</p>
        <button
          type="button"
          onClick={onAddDefault}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-ink-700"
        >
          <Plus className="h-4 w-4" /> Add default zone
        </button>
        <p className="text-xs text-slate-500">…or just drag on the image to draw one.</p>
      </div>
    );
  }

  const maxR = Math.floor(Math.min(mask.width, mask.height) / 2);
  const setRadii = (patch: Partial<CornerRadii>) =>
    onUpdate({ radii: { ...mask.radii, ...patch } });
  const setAllRadii = (v: number) =>
    onUpdate({ radii: { tl: v, tr: v, br: v, bl: v } });

  return (
    <div className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
      <p className="text-sm font-medium text-slate-200">Zone geometry (natural px)</p>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={Math.round(mask.x)} max={natural.width} onChange={(v) => onUpdate({ x: v })} />
        <NumberField label="Y" value={Math.round(mask.y)} max={natural.height} onChange={(v) => onUpdate({ y: v })} />
        <NumberField label="W" value={Math.round(mask.width)} max={natural.width} onChange={(v) => onUpdate({ width: v })} />
        <NumberField label="H" value={Math.round(mask.height)} max={natural.height} onChange={(v) => onUpdate({ height: v })} />
      </div>

      <div className="border-t border-ink-800 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-200">Corner radii</p>
          <button
            type="button"
            onClick={() => {
              if (!linked) setAllRadii(mask.radii.tl);
              setLinked((v) => !v);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-ink-700"
          >
            {linked ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
            {linked ? "Linked" : "Independent"}
          </button>
        </div>

        {linked ? (
          <RadiusSlider
            label="All corners"
            value={mask.radii.tl}
            max={maxR}
            onChange={setAllRadii}
          />
        ) : (
          <div className="space-y-1">
            <RadiusSlider label="Top-left" value={mask.radii.tl} max={maxR} onChange={(v) => setRadii({ tl: v })} />
            <RadiusSlider label="Top-right" value={mask.radii.tr} max={maxR} onChange={(v) => setRadii({ tr: v })} />
            <RadiusSlider label="Bottom-right" value={mask.radii.br} max={maxR} onChange={(v) => setRadii({ br: v })} />
            <RadiusSlider label="Bottom-left" value={mask.radii.bl} max={maxR} onChange={(v) => setRadii({ bl: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg bg-ink-800/60 px-2.5 py-1.5 text-xs">
      <span className="w-4 font-medium text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        max={Math.round(max)}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent text-right font-mono text-slate-100 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}

function RadiusSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-1">
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span className="font-mono">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(max))}
        value={Math.min(value, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function SaveToLibrary({
  template,
  mask,
  onSaved,
}: {
  template: TemplateAsset;
  mask: DetectedMask | null;
  onSaved: (asset: TemplateAsset) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Prefill the name when the asset (or its library origin) changes.
  useEffect(() => {
    setName(template.name ?? deriveName(template.file.name));
    setStatus(null);
  }, [template]);

  const save = useCallback(async () => {
    if (!mask) return;
    setSaving(true);
    setStatus(null);
    try {
      const id = template.sourceId ?? makeId("tpl");
      let createdAt = Date.now();
      if (template.sourceId) {
        const existing = await getTemplate(template.sourceId);
        if (existing) createdAt = existing.createdAt;
      }
      const finalName = name.trim() || deriveName(template.file.name);
      await putTemplate({
        id,
        name: finalName,
        blob: template.file,
        mimeType: template.file.type || "image/png",
        naturalWidth: template.naturalWidth,
        naturalHeight: template.naturalHeight,
        mask,
        createdAt,
        updatedAt: Date.now(),
      });
      // Reflect the persisted id/name so a subsequent save updates in place.
      onSaved({ ...template, sourceId: id, name: finalName });
      setStatus(template.sourceId ? "Updated in library." : "Saved to library.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [mask, name, template, onSaved]);

  return (
    <div className="space-y-2 rounded-2xl border border-ink-700 bg-ink-900/60 p-4">
      <p className="text-sm font-medium text-slate-200">Save to library</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Template name"
        className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-brand-500"
      />
      <button
        type="button"
        onClick={save}
        disabled={!mask || saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-medium text-slate-200 transition enabled:hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : template.sourceId ? "Update in library" : "Save to library"}
      </button>
      {!mask && (
        <p className="text-[11px] text-slate-500">Calibrate a zone first to enable saving.</p>
      )}
      {status && <p className="text-[11px] text-brand-300">{status}</p>}
    </div>
  );
}

function deriveName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base || "Template";
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
