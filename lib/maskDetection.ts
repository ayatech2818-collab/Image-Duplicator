/**
 * Placeholder-zone detection.
 *
 * Given a rendered template and a click point, we flood-fill the contiguous
 * region of similarly-coloured pixels (the dark placeholder), compute its
 * bounding box, and approximate the corner radii. To stay fast and memory-safe
 * on very large templates, the analysis runs on a downscaled copy and the
 * results are mapped back into the template's true natural pixel space.
 */

import type { CornerRadii, DetectedMask } from "./types";

/** Longest edge (px) used for the internal analysis bitmap. */
const ANALYSIS_MAX = 1400;

/** Colour distance tolerance for the flood fill (0..~441 in RGB space). */
const DEFAULT_TOLERANCE = 48;

/** Corner radii within this fraction of each other are treated as uniform. */
const UNIFORM_TOLERANCE_FRAC = 0.18;

interface AnalysisCanvas {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** natural / analysis ratio used to scale results back up. */
  scale: number;
}

/**
 * Draw the template into an offscreen canvas no larger than ANALYSIS_MAX on its
 * longest edge and return its pixel data plus the upscale factor.
 */
export function buildAnalysisCanvas(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
): AnalysisCanvas {
  const longest = Math.max(naturalWidth, naturalHeight);
  const ratio = longest > ANALYSIS_MAX ? ANALYSIS_MAX / longest : 1;
  const width = Math.max(1, Math.round(naturalWidth * ratio));
  const height = Math.max(1, Math.round(naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(source, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  // natural = analysis * scale
  return { data, width, height, scale: 1 / ratio };
}

function colorDistanceSq(
  data: Uint8ClampedArray,
  idx: number,
  r: number,
  g: number,
  b: number,
): number {
  const dr = data[idx] - r;
  const dg = data[idx + 1] - g;
  const db = data[idx + 2] - b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Stack-based 4-connected flood fill. Returns a visited mask (1 = inside zone)
 * plus the bounding box, all in analysis-space pixels.
 */
function floodFill(
  analysis: AnalysisCanvas,
  startX: number,
  startY: number,
  tolerance: number,
): {
  mask: Uint8Array;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  count: number;
} {
  const { data, width, height } = analysis;
  const mask = new Uint8Array(width * height);
  const startIdx = (startY * width + startX) * 4;
  const r = data[startIdx];
  const g = data[startIdx + 1];
  const b = data[startIdx + 2];
  const tolSq = tolerance * tolerance;

  // Explicit stack of pixel indices (not coords) to avoid allocation churn.
  const stack: number[] = [startY * width + startX];
  let minX = startX,
    minY = startY,
    maxX = startX,
    maxY = startY,
    count = 0;

  while (stack.length > 0) {
    const p = stack.pop() as number;
    if (mask[p]) continue;
    if (colorDistanceSq(data, p * 4, r, g, b) > tolSq) continue;

    mask[p] = 1;
    count += 1;
    const x = p % width;
    const y = (p - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }

  return { mask, minX, minY, maxX, maxY, count };
}

/**
 * Approximate a single corner radius by measuring how far the filled region is
 * inset from the bounding-box corner along the adjacent top/bottom edge and the
 * adjacent left/right edge, then averaging. On a rounded rectangle both insets
 * equal the radius; averaging cancels noise.
 */
function estimateCorner(
  mask: Uint8Array,
  width: number,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  corner: "tl" | "tr" | "br" | "bl",
): number {
  const { minX, minY, maxX, maxY } = bbox;
  const at = (x: number, y: number) => mask[y * width + x] === 1;

  const horizontalEdgeY = corner === "tl" || corner === "tr" ? minY : maxY;
  const verticalEdgeX = corner === "tl" || corner === "bl" ? minX : maxX;
  const towardRight = corner === "tl" || corner === "bl";
  const towardDown = corner === "tl" || corner === "tr";

  // Along the horizontal edge row: distance from the vertical edge to first fill.
  let hInset = 0;
  for (let i = 0; i <= maxX - minX; i += 1) {
    const x = towardRight ? verticalEdgeX + i : verticalEdgeX - i;
    if (x < minX || x > maxX) break;
    if (at(x, horizontalEdgeY)) {
      hInset = i;
      break;
    }
  }

  // Along the vertical edge column: distance from the horizontal edge to first fill.
  let vInset = 0;
  for (let i = 0; i <= maxY - minY; i += 1) {
    const y = towardDown ? horizontalEdgeY + i : horizontalEdgeY - i;
    if (y < minY || y > maxY) break;
    if (at(verticalEdgeX, y)) {
      vInset = i;
      break;
    }
  }

  return (hInset + vInset) / 2;
}

export interface DetectionResult {
  mask: DetectedMask;
  /** Coverage of the bounding box by the filled region (0..1); low = noisy click. */
  fillRatio: number;
}

/**
 * Detect the placeholder zone from a click point given in the template's natural
 * pixel coordinates. Returns geometry in natural pixels.
 */
export function detectMaskAtPoint(
  analysis: AnalysisCanvas,
  naturalX: number,
  naturalY: number,
  tolerance: number = DEFAULT_TOLERANCE,
): DetectionResult | null {
  const ax = Math.round(naturalX / analysis.scale);
  const ay = Math.round(naturalY / analysis.scale);
  if (ax < 0 || ay < 0 || ax >= analysis.width || ay >= analysis.height) {
    return null;
  }

  const fill = floodFill(analysis, ax, ay, tolerance);
  const boxW = fill.maxX - fill.minX + 1;
  const boxH = fill.maxY - fill.minY + 1;
  if (boxW < 4 || boxH < 4) return null;

  const radiiAnalysis: Record<"tl" | "tr" | "br" | "bl", number> = {
    tl: estimateCorner(fill.mask, analysis.width, fill, "tl"),
    tr: estimateCorner(fill.mask, analysis.width, fill, "tr"),
    br: estimateCorner(fill.mask, analysis.width, fill, "br"),
    bl: estimateCorner(fill.mask, analysis.width, fill, "bl"),
  };

  const s = analysis.scale;
  const radii: CornerRadii = {
    tl: radiiAnalysis.tl * s,
    tr: radiiAnalysis.tr * s,
    br: radiiAnalysis.br * s,
    bl: radiiAnalysis.bl * s,
  };

  const values = [radii.tl, radii.tr, radii.br, radii.bl];
  const maxR = Math.max(...values);
  const minR = Math.min(...values);
  const uniform = maxR <= 1 || (maxR - minR) / maxR <= UNIFORM_TOLERANCE_FRAC;

  // Clamp radii so they can never exceed half the box (invalid rounded rect).
  const naturalW = boxW * s;
  const naturalH = boxH * s;
  const cap = Math.min(naturalW, naturalH) / 2;
  const clamp = (v: number) => Math.max(0, Math.min(v, cap));

  const mask: DetectedMask = {
    x: fill.minX * s,
    y: fill.minY * s,
    width: naturalW,
    height: naturalH,
    radii: {
      tl: clamp(radii.tl),
      tr: clamp(radii.tr),
      br: clamp(radii.br),
      bl: clamp(radii.bl),
    },
    uniform,
  };

  return { mask, fillRatio: fill.count / (boxW * boxH) };
}
