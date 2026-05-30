# Poster Forge

A single-page, **100% client-side** utility (Next.js App Router · TypeScript · Tailwind) for batch-generating high-resolution promotional posters. Upload a master template, click the dark placeholder to auto-detect its bounding box and corner radii, bulk-load personal photos, fine-tune framing, then render and export the whole batch as a ZIP — no server, no upload of personal images.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run typecheck
```

## Pipeline

1. **Template & smart-zone detection** — drag-drop the master poster, then click inside the dark placeholder. A flood-fill over `getImageData` (run on a downscaled analysis bitmap for speed, then mapped back to true `naturalWidth`/`naturalHeight`) traces the contiguous region, computes the bounding box, and approximates per-corner radii (reports *uniform* vs *asymmetric*). A live wireframe overlays the detected zone; a tolerance slider re-tunes detection.
2. **Batch photos & fit strategy** — bulk-upload 10–100 photos. Global toggle:
   - **Smart Fit (No Crop):** the whole photo stays visible (contain), and gaps inside the mask are filled with a duplicated, `blur(...)`-ed cover copy underneath — the subject is never cropped.
   - **Fill Frame (Center Crop):** standard aspect-cover.
3. **Adjust** — gallery of live composited previews. Click any photo to open a micro-modal with **Zoom** and **Position X/Y** sliders that override the automatic fit.
4. **Generate** — a bounded-concurrency promise pool (3 at a time) composes each poster off-screen at native resolution (`drawImage` → rounded-rect `clip()` → adaptive fit → `toBlob` JPEG @ 0.95), yielding to the event loop between tasks so the UI stays fluid. Progress shows *Processing N of M…*.
5. **Export** — results grid with per-thumbnail download plus **Download all as ZIP** (`jszip` + `file-saver`, sequentially numbered).

## Layout

| Path | Responsibility |
|------|----------------|
| `lib/types.ts` | Shared domain types (all geometry in natural px) |
| `lib/maskDetection.ts` | Flood-fill, bounding box, corner-radius estimation |
| `lib/composition.ts` | Rounded-rect clip path + Smart/Fill draw math + JPEG encode |
| `lib/queue.ts` | Bounded-concurrency promise pool with progress |
| `lib/zip.ts` | Client-side ZIP bundling |
| `lib/store.ts` | Zustand session store (with object-URL cleanup) |
| `components/ui/` | `Dropzone`, `Stepper`, `CompositeCanvas` (shared live preview) |
| `components/steps/` | One component per pipeline step |
