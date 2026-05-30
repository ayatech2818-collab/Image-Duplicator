/**
 * Shared domain types for the poster-generation pipeline.
 * All geometry is expressed in the template's *natural* (intrinsic) pixel space
 * unless explicitly suffixed otherwise.
 */

/** Per-corner radii (top-left, top-right, bottom-right, bottom-left) in natural px. */
export interface CornerRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

/** The detected placeholder zone, in the template's natural pixel coordinates. */
export interface DetectedMask {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: CornerRadii;
  /** True when all four corner radii are within a small tolerance of each other. */
  uniform: boolean;
}

export interface TemplateAsset {
  file: File;
  /** Object URL for on-screen rendering. */
  url: string;
  /** Intrinsic dimensions of the source template file. */
  naturalWidth: number;
  naturalHeight: number;
  /** Id of the library record this asset was loaded from, if any. */
  sourceId?: string;
  /** Human-friendly name carried over from the library. */
  name?: string;
}

/** How the calibration workspace is currently being driven. */
export type CalibrationMode = "auto" | "manual";

/** Fit strategy applied when compositing a personal photo into the mask. */
export type FitMode = "smart" | "fill";

/** Per-photo manual overrides applied on top of the automatic fit math. */
export interface PhotoAdjustment {
  /** Multiplier on the base (auto) scale. 1 = automatic. */
  zoom: number;
  /** Horizontal nudge as a fraction of mask width (-1..1). */
  offsetX: number;
  /** Vertical nudge as a fraction of mask height (-1..1). */
  offsetY: number;
}

export const DEFAULT_ADJUSTMENT: PhotoAdjustment = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

export type PhotoStatus =
  | "pending"
  | "queued"
  | "processing"
  | "done"
  | "error";

export interface PhotoItem {
  id: string;
  file: File;
  /** Object URL of the original upload (used for previews/thumbnails). */
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  adjustment: PhotoAdjustment;
  status: PhotoStatus;
  /** Object URL of the rendered poster, once generated. */
  resultUrl?: string;
  resultBlob?: Blob;
  error?: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;
