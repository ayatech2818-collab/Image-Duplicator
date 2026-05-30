"use client";

import { create } from "zustand";
import {
  DEFAULT_ADJUSTMENT,
  type DetectedMask,
  type FitMode,
  type PhotoAdjustment,
  type PhotoItem,
  type TemplateAsset,
  type WizardStep,
} from "./types";
import { makeId } from "./image";

interface GenerationState {
  running: boolean;
  completed: number;
  total: number;
}

interface PosterState {
  step: WizardStep;
  template: TemplateAsset | null;
  mask: DetectedMask | null;
  photos: PhotoItem[];
  fitMode: FitMode;
  generation: GenerationState;

  setStep: (step: WizardStep) => void;
  setTemplate: (template: TemplateAsset | null) => void;
  setMask: (mask: DetectedMask | null) => void;
  setFitMode: (mode: FitMode) => void;

  addPhotos: (photos: PhotoItem[]) => void;
  removePhoto: (id: string) => void;
  clearPhotos: () => void;
  updateAdjustment: (id: string, adjustment: Partial<PhotoAdjustment>) => void;
  resetAdjustment: (id: string) => void;

  beginGeneration: (total: number) => void;
  markPhotoStatus: (
    id: string,
    patch: Partial<Pick<PhotoItem, "status" | "resultUrl" | "resultBlob" | "error">>,
  ) => void;
  tickGeneration: () => void;
  endGeneration: () => void;

  resetSession: () => void;
}

export const usePosterStore = create<PosterState>((set) => ({
  step: 1,
  template: null,
  mask: null,
  photos: [],
  fitMode: "smart",
  generation: { running: false, completed: 0, total: 0 },

  setStep: (step) => set({ step }),

  setTemplate: (template) =>
    set((state) => {
      if (state.template && state.template.url !== template?.url) {
        URL.revokeObjectURL(state.template.url);
      }
      return { template, mask: null };
    }),

  setMask: (mask) => set({ mask }),
  setFitMode: (fitMode) => set({ fitMode }),

  addPhotos: (photos) =>
    set((state) => ({ photos: [...state.photos, ...photos] })),

  removePhoto: (id) =>
    set((state) => {
      const target = state.photos.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        if (target.resultUrl) URL.revokeObjectURL(target.resultUrl);
      }
      return { photos: state.photos.filter((p) => p.id !== id) };
    }),

  clearPhotos: () =>
    set((state) => {
      state.photos.forEach((p) => {
        URL.revokeObjectURL(p.url);
        if (p.resultUrl) URL.revokeObjectURL(p.resultUrl);
      });
      return { photos: [] };
    }),

  updateAdjustment: (id, adjustment) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id
          ? { ...p, adjustment: { ...p.adjustment, ...adjustment } }
          : p,
      ),
    })),

  resetAdjustment: (id) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, adjustment: { ...DEFAULT_ADJUSTMENT } } : p,
      ),
    })),

  beginGeneration: (total) =>
    set((state) => ({
      generation: { running: true, completed: 0, total },
      // Clear stale results before a fresh run.
      photos: state.photos.map((p) => {
        if (p.resultUrl) URL.revokeObjectURL(p.resultUrl);
        return { ...p, status: "queued", resultUrl: undefined, resultBlob: undefined, error: undefined };
      }),
    })),

  markPhotoStatus: (id, patch) =>
    set((state) => ({
      photos: state.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  tickGeneration: () =>
    set((state) => ({
      generation: {
        ...state.generation,
        completed: state.generation.completed + 1,
      },
    })),

  endGeneration: () =>
    set((state) => ({
      generation: { ...state.generation, running: false },
    })),

  resetSession: () =>
    set((state) => {
      if (state.template) URL.revokeObjectURL(state.template.url);
      state.photos.forEach((p) => {
        URL.revokeObjectURL(p.url);
        if (p.resultUrl) URL.revokeObjectURL(p.resultUrl);
      });
      return {
        step: 1,
        template: null,
        mask: null,
        photos: [],
        fitMode: "smart",
        generation: { running: false, completed: 0, total: 0 },
      };
    }),
}));

/** Factory for a fresh photo item with default adjustment. */
export function createPhotoItem(
  file: File,
  url: string,
  naturalWidth: number,
  naturalHeight: number,
): PhotoItem {
  return {
    id: makeId("photo"),
    file,
    url,
    naturalWidth,
    naturalHeight,
    adjustment: { ...DEFAULT_ADJUSTMENT },
    status: "pending",
  };
}
