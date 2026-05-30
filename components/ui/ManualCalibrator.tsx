"use client";

import { useRef } from "react";
import { normalizeMask } from "@/lib/maskDetection";
import type { DetectedMask } from "@/lib/types";

/** Minimum box size, in natural px, to keep a zone usable. */
const MIN_SIZE = 12;

type HandleId =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

type DragMode = HandleId | "move" | "draw";

interface DragState {
  mode: DragMode;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** Mask geometry at drag start (natural px). */
  orig: DetectedMask;
  /** Anchor point for a fresh draw (natural px). */
  anchorX: number;
  anchorY: number;
}

const HANDLES: { id: HandleId; cursor: string; style: React.CSSProperties }[] = [
  { id: "nw", cursor: "nwse-resize", style: { left: 0, top: 0 } },
  { id: "n", cursor: "ns-resize", style: { left: "50%", top: 0 } },
  { id: "ne", cursor: "nesw-resize", style: { left: "100%", top: 0 } },
  { id: "e", cursor: "ew-resize", style: { left: "100%", top: "50%" } },
  { id: "se", cursor: "nwse-resize", style: { left: "100%", top: "100%" } },
  { id: "s", cursor: "ns-resize", style: { left: "50%", top: "100%" } },
  { id: "sw", cursor: "nesw-resize", style: { left: 0, top: "100%" } },
  { id: "w", cursor: "ew-resize", style: { left: 0, top: "50%" } },
];

interface ManualCalibratorProps {
  mask: DetectedMask | null;
  natural: { width: number; height: number };
  rendered: { width: number; height: number };
  onChange: (mask: DetectedMask) => void;
}

/**
 * On-canvas manual calibration overlay. Lets the operator draw a target zone
 * from scratch, drag it around, or resize it from any of eight handles. All
 * interaction happens in the responsive display space and is translated back to
 * the template's absolute native pixel coordinates before emitting.
 */
export function ManualCalibrator({
  mask,
  natural,
  rendered,
  onChange,
}: ManualCalibratorProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const sx = rendered.width / natural.width;
  const sy = rendered.height / natural.height;

  /** Convert a client point to natural pixel coordinates. */
  const toNatural = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * natural.width,
      y: ((clientY - rect.top) / rect.height) * natural.height,
    };
  };

  const beginDrag = (
    e: React.PointerEvent,
    mode: DragMode,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const point = toNatural(e.clientX, e.clientY);
    const orig: DetectedMask =
      mask ?? {
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        radii: { tl: 0, tr: 0, br: 0, bl: 0 },
        uniform: true,
      };
    dragRef.current = {
      mode,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      orig,
      anchorX: point.x,
      anchorY: point.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;

    const dxNat = ((e.clientX - drag.startClientX) / rendered.width) * natural.width;
    const dyNat = ((e.clientY - drag.startClientY) / rendered.height) * natural.height;
    const { orig } = drag;

    let next: DetectedMask;

    if (drag.mode === "draw") {
      const cur = toNatural(e.clientX, e.clientY);
      const x = Math.min(drag.anchorX, cur.x);
      const y = Math.min(drag.anchorY, cur.y);
      next = {
        ...orig,
        x,
        y,
        width: Math.abs(cur.x - drag.anchorX),
        height: Math.abs(cur.y - drag.anchorY),
      };
    } else if (drag.mode === "move") {
      next = { ...orig, x: orig.x + dxNat, y: orig.y + dyNat };
    } else {
      // Resize from a handle. East/South grow with positive delta; West/North
      // keep the opposite edge pinned so the box never flips.
      let { x, y, width, height } = orig;
      const id = drag.mode;
      if (id.includes("e")) {
        width = Math.max(MIN_SIZE, orig.width + dxNat);
      }
      if (id.includes("w")) {
        width = Math.max(MIN_SIZE, orig.width - dxNat);
        x = orig.x + (orig.width - width);
      }
      if (id.includes("s")) {
        height = Math.max(MIN_SIZE, orig.height + dyNat);
      }
      if (id.includes("n")) {
        height = Math.max(MIN_SIZE, orig.height - dyNat);
        y = orig.y + (orig.height - height);
      }
      next = { ...orig, x, y, width, height };
    }

    onChange(normalizeMask(next, natural.width, natural.height));
  };

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  };

  return (
    <div
      ref={surfaceRef}
      onPointerDown={(e) => beginDrag(e, "draw")}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="absolute inset-0 cursor-crosshair touch-none"
    >
      {mask && (
        <div
          onPointerDown={(e) => beginDrag(e, "move")}
          className="absolute cursor-move border-2 border-brand-400 bg-brand-400/10"
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
          {HANDLES.map((h) => (
            <span
              key={h.id}
              onPointerDown={(e) => beginDrag(e, h.id)}
              style={{ ...h.style, cursor: h.cursor }}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-brand-500 shadow"
            />
          ))}
        </div>
      )}
    </div>
  );
}
