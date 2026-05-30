/**
 * Off-screen poster composition at full native template resolution.
 *
 * Pipeline per poster:
 *   1. draw the base template,
 *   2. clip to the detected (optionally rounded) placeholder box,
 *   3. draw the personal photo using the chosen fit strategy + manual overrides,
 *   4. encode to a high-quality JPEG blob.
 */

import { decodeToDrawable, loadImageElement } from "./image";
import type {
  CornerRadii,
  DetectedMask,
  FitMode,
  PhotoAdjustment,
  TemplateAsset,
} from "./types";

/** Build a rounded-rectangle path supporting asymmetric corner radii. */
export function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: CornerRadii,
): void {
  const cap = Math.min(w, h) / 2;
  const tl = Math.min(radii.tl, cap);
  const tr = Math.min(radii.tr, cap);
  const br = Math.min(radii.br, cap);
  const bl = Math.min(radii.bl, cap);

  // Prefer the native roundRect (asymmetric ordering: tl, tr, br, bl).
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [tl, tr, br, bl]);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

interface Placement {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** "cover" placement (max-scale, may overflow the box) plus zoom/offset. */
function placeCover(
  mask: DetectedMask,
  photoW: number,
  photoH: number,
  adj: PhotoAdjustment,
): Placement {
  const base = Math.max(mask.width / photoW, mask.height / photoH);
  const scale = base * adj.zoom;
  const dw = photoW * scale;
  const dh = photoH * scale;
  const dx = mask.x + (mask.width - dw) / 2 + adj.offsetX * mask.width;
  const dy = mask.y + (mask.height - dh) / 2 + adj.offsetY * mask.height;
  return { dx, dy, dw, dh };
}

/** "contain" placement (min-scale, fully visible) plus zoom/offset. */
function placeContain(
  mask: DetectedMask,
  photoW: number,
  photoH: number,
  adj: PhotoAdjustment,
): Placement {
  const base = Math.min(mask.width / photoW, mask.height / photoH);
  const scale = base * adj.zoom;
  const dw = photoW * scale;
  const dh = photoH * scale;
  const dx = mask.x + (mask.width - dw) / 2 + adj.offsetX * mask.width;
  const dy = mask.y + (mask.height - dh) / 2 + adj.offsetY * mask.height;
  return { dx, dy, dw, dh };
}

/**
 * Draw a photo into an already-clipped context using the selected fit mode.
 *
 * Smart Fit: lay down a heavily blurred *cover* copy to fill the mask, then
 * draw the fully-visible (contain) photo on top so the subject is never cropped.
 * Fill Frame: standard centre-crop cover.
 */
export function drawPhotoIntoMask(
  ctx: CanvasRenderingContext2D,
  photo: CanvasImageSource,
  photoW: number,
  photoH: number,
  mask: DetectedMask,
  mode: FitMode,
  adj: PhotoAdjustment,
): void {
  if (mode === "fill") {
    const p = placeCover(mask, photoW, photoH, adj);
    ctx.drawImage(photo, p.dx, p.dy, p.dw, p.dh);
    return;
  }

  // Smart Fit — blurred backdrop first.
  const blurRadius = Math.max(
    12,
    Math.round(Math.min(mask.width, mask.height) * 0.04),
  );
  const back = placeCover(mask, photoW, photoH, { ...adj, zoom: 1 });
  ctx.save();
  ctx.filter = `blur(${blurRadius}px)`;
  // Slightly over-scale the backdrop so the blur's translucent edges never
  // reveal the template behind the mask.
  const bleed = 1.12;
  ctx.drawImage(
    photo,
    back.dx - (back.dw * (bleed - 1)) / 2,
    back.dy - (back.dh * (bleed - 1)) / 2,
    back.dw * bleed,
    back.dh * bleed,
  );
  ctx.restore();

  // Sharp, fully-visible foreground.
  const fg = placeContain(mask, photoW, photoH, adj);
  ctx.drawImage(photo, fg.dx, fg.dy, fg.dw, fg.dh);
}

/** A reusable template drawable + dimensions, decoded once per batch. */
export interface PreparedTemplate {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export async function prepareTemplate(
  template: TemplateAsset,
): Promise<PreparedTemplate> {
  const img = await loadImageElement(template.url);
  return {
    source: img,
    width: template.naturalWidth,
    height: template.naturalHeight,
  };
}

/**
 * Compose one poster at full native resolution and return a JPEG blob.
 * The personal photo is decoded inside (off-main-thread when possible).
 */
export async function composePoster(
  template: PreparedTemplate,
  photoFile: File,
  mask: DetectedMask,
  mode: FitMode,
  adj: PhotoAdjustment,
  quality = 0.95,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // (a) base poster
  ctx.drawImage(template.source, 0, 0, template.width, template.height);

  // (b) clip to placeholder
  const photo = await decodeToDrawable(photoFile);
  ctx.save();
  pathRoundedRect(ctx, mask.x, mask.y, mask.width, mask.height, mask.radii);
  ctx.clip();

  // (c) adaptive fit / overrides
  drawPhotoIntoMask(ctx, photo, photo.width, photo.height, mask, mode, adj);
  ctx.restore();

  if (typeof (photo as ImageBitmap).close === "function") {
    (photo as ImageBitmap).close();
  }

  // (d) encode
  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  // Release the large backing store promptly.
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas encoding failed."));
      },
      type,
      quality,
    );
  });
}
