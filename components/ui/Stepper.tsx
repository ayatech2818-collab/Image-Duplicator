"use client";

import { Check } from "lucide-react";
import type { WizardStep } from "@/lib/types";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Template" },
  { id: 2, label: "Photos" },
  { id: 3, label: "Adjust" },
  { id: 4, label: "Generate" },
  { id: 5, label: "Export" },
];

interface StepperProps {
  current: WizardStep;
  /** Highest step the user is allowed to jump to. */
  maxReachable: WizardStep;
  onSelect: (step: WizardStep) => void;
}

export function Stepper({ current, maxReachable, onSelect }: StepperProps) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((step, i) => {
          const done = step.id < current;
          const active = step.id === current;
          const reachable = step.id <= maxReachable;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onSelect(step.id)}
                className={`flex items-center gap-2 rounded-full px-2 py-1 transition-colors ${
                  reachable ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    active
                      ? "border-brand-400 bg-brand-500 text-white"
                      : done
                        ? "border-brand-500/40 bg-brand-500/20 text-brand-400"
                        : "border-ink-700 bg-ink-800 text-slate-400"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : step.id}
                </span>
                <span
                  className={`hidden text-sm font-medium sm:inline ${
                    active ? "text-white" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  className={`h-px flex-1 ${
                    done ? "bg-brand-500/40" : "bg-ink-700"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
