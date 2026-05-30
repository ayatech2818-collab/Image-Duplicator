"use client";

import { useEffect, useRef, useState } from "react";
import { drawPhotoIntoMask, pathRoundedRect } from "@/lib/composition";
import { loadImageElement } from "@/lib/image";
import type { DetectedMask, FitMode, PhotoAdjustment } from "@/lib/types";

/** Cache decoded <img> elements by object URL so previews don't re-decode. */
function useImageElement(url: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    setImg(null);
    if (!url) return;
    loadImageElement(url)
      .then((el) => {
        if (alive) setImg(el);
      })
      .catch(() => {
        if (alive) setImg(null);
      });
    return () => {
      alive = false;
    };
  }, [url]);
  return img;
}

interface CompositeCanvasProps {
  templateUrl: string;
  templateWidth: number;
  templateHeight: number;
  photoUrl: string;
  mask: DetectedMask;
  mode: FitMode;
  adjustment: PhotoAdjustment;
  /** Longest preview edge in CSS pixels. */
  maxEdge?: number;
  className?: string;
}

/**
 * Live, downscaled preview of a single composed poster. Reuses the exact
 * production composition math (scaled uniformly) so what the operator sees in
 * the adjustment modal matches the full-resolution export.
 */
export function CompositeCanvas({
  templateUrl,
  templateWidth,
  templateHeight,
  photoUrl,
  mask,
  mode,
  adjustment,
  maxEdge = 520,
  className = "",
}: CompositeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const template = useImageElement(templateUrl);
  const photo = useImageElement(photoUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !template || !photo) return;

    const longest = Math.max(templateWidth, templateHeight);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.max(1, Math.round(templateWidth * scale));
    const h = Math.max(1, Math.round(templateHeight * scale));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, templateWidth, templateHeight);

    ctx.drawImage(template, 0, 0, templateWidth, templateHeight);

    ctx.save();
    pathRoundedRect(ctx, mask.x, mask.y, mask.width, mask.height, mask.radii);
    ctx.clip();
    drawPhotoIntoMask(
      ctx,
      photo,
      photo.naturalWidth,
      photo.naturalHeight,
      mask,
      mode,
      adjustment,
    );
    ctx.restore();
  }, [
    template,
    photo,
    templateWidth,
    templateHeight,
    maxEdge,
    mask,
    mode,
    adjustment,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={`max-w-full rounded-lg ${className}`}
      aria-label="Poster preview"
    />
  );
}
