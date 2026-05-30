"use client";

import { useState } from "react";
import { Layers, Library } from "lucide-react";
import { LibraryPanel } from "@/components/library/LibraryPanel";
import { Stepper } from "@/components/ui/Stepper";
import { Step1Template } from "@/components/steps/Step1Template";
import { Step2Photos } from "@/components/steps/Step2Photos";
import { Step3Adjust } from "@/components/steps/Step3Adjust";
import { Step4Generate } from "@/components/steps/Step4Generate";
import { Step5Gallery } from "@/components/steps/Step5Gallery";
import { usePosterStore } from "@/lib/store";
import type { WizardStep } from "@/lib/types";

export default function Home() {
  const step = usePosterStore((s) => s.step);
  const setStep = usePosterStore((s) => s.setStep);
  const mask = usePosterStore((s) => s.mask);
  const photos = usePosterStore((s) => s.photos);

  const [libraryOpen, setLibraryOpen] = useState(false);

  const hasPhotos = photos.length > 0;
  const hasResults = photos.some((p) => p.status === "done");

  // Furthest step the user is permitted to navigate to via the stepper.
  let maxReachable: WizardStep = 1;
  if (mask) maxReachable = 2;
  if (mask && hasPhotos) maxReachable = 4;
  if (hasResults) maxReachable = 5;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 shadow-lg shadow-brand-600/30">
          <Layers className="h-6 w-6 text-white" />
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Poster Forge
          </h1>
          <p className="text-sm text-slate-400">
            Batch-fit photos into a poster template — fully client-side.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-ink-800"
        >
          <Library className="h-4 w-4 text-brand-400" />
          <span className="hidden sm:inline">Library</span>
        </button>
      </header>

      <div className="mb-8 rounded-2xl border border-ink-800 bg-ink-900/40 p-4">
        <Stepper current={step} maxReachable={maxReachable} onSelect={setStep} />
      </div>

      <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-5 sm:p-7">
        {step === 1 && <Step1Template />}
        {step === 2 && <Step2Photos />}
        {step === 3 && <Step3Adjust />}
        {step === 4 && <Step4Generate />}
        {step === 5 && <Step5Gallery />}
      </div>

      <footer className="mt-8 text-center text-xs text-slate-600">
        Photos never leave your device — detection, composition, and ZIP export
        all run in the browser.
      </footer>

      <LibraryPanel open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </main>
  );
}
