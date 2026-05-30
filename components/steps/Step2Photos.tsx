"use client";

import { useCallback, useState } from "react";
import { Crop, ImagePlus, Maximize, Trash2, X } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Header } from "@/components/steps/Step1Template";
import { readNaturalSize } from "@/lib/image";
import { createPhotoItem, usePosterStore } from "@/lib/store";
import type { FitMode } from "@/lib/types";

const MAX_PHOTOS = 100;

export function Step2Photos() {
  const photos = usePosterStore((s) => s.photos);
  const addPhotos = usePosterStore((s) => s.addPhotos);
  const removePhoto = usePosterStore((s) => s.removePhoto);
  const clearPhotos = usePosterStore((s) => s.clearPhotos);
  const fitMode = usePosterStore((s) => s.fitMode);
  const setFitMode = usePosterStore((s) => s.setFitMode);
  const setStep = usePosterStore((s) => s.setStep);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setNotice(null);
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) {
        setNotice(`Limit reached — ${MAX_PHOTOS} photos max per batch.`);
        return;
      }
      const accepted = files.slice(0, remaining);
      if (files.length > accepted.length) {
        setNotice(`Only the first ${accepted.length} photos were added (max ${MAX_PHOTOS}).`);
      }

      setLoading(true);
      const items = await Promise.all(
        accepted.map(async (file) => {
          const url = URL.createObjectURL(file);
          try {
            const { width, height } = await readNaturalSize(file);
            return createPhotoItem(file, url, width, height);
          } catch {
            URL.revokeObjectURL(url);
            return null;
          }
        }),
      );
      const valid = items.filter((i): i is NonNullable<typeof i> => i !== null);
      if (valid.length) addPhotos(valid);
      if (valid.length < accepted.length) {
        setNotice("Some files were skipped because they couldn't be decoded.");
      }
      setLoading(false);
    },
    [photos.length, addPhotos],
  );

  return (
    <section className="space-y-5">
      <Header
        index={2}
        title="Batch personal photos & fit strategy"
        subtitle="Bulk-upload 10–100 photos of any size, then choose how each one fills the placeholder."
      />

      <FitToggle mode={fitMode} onChange={setFitMode} />

      <Dropzone
        onFiles={handleFiles}
        multiple
        disabled={loading}
        className="px-6 py-10"
      >
        <ImagePlus className="mb-3 h-9 w-9 text-brand-400" />
        <p className="text-base font-medium text-slate-200">
          {loading ? "Reading photos…" : "Drop personal photos here"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Passport photos, selfies, landscape frames — {photos.length}/{MAX_PHOTOS} added
        </p>
      </Dropzone>

      {notice && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {notice}
        </p>
      )}

      {photos.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              <span className="font-semibold text-slate-200">{photos.length}</span>{" "}
              photo{photos.length === 1 ? "" : "s"} ready
            </p>
            <button
              type="button"
              onClick={clearPhotos}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          </div>

          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {photos.map((p) => (
              <li
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-ink-700 bg-ink-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  className="absolute right-1 top-1 rounded-full bg-ink-950/80 p-1 text-slate-300 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                  aria-label={`Remove ${p.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
            >
              Continue to adjust
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function FitToggle({
  mode,
  onChange,
}: {
  mode: FitMode;
  onChange: (mode: FitMode) => void;
}) {
  const options: {
    id: FitMode;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "smart",
      title: "Smart Fit (No Crop)",
      desc: "Whole photo stays visible; gaps filled with a blurred copy underneath.",
      icon: <Maximize className="h-4 w-4" />,
    },
    {
      id: "fill",
      title: "Fill Frame (Center Crop)",
      desc: "Edge-to-edge cover. Best for backgrounds; may crop edges.",
      icon: <Crop className="h-4 w-4" />,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
              active
                ? "border-brand-400 bg-brand-500/10"
                : "border-ink-700 bg-ink-900/60 hover:border-ink-600"
            }`}
          >
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                active ? "bg-brand-500 text-white" : "bg-ink-800 text-slate-400"
              }`}
            >
              {o.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                {o.title}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {o.desc}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
