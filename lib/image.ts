/** Browser image-loading helpers shared across the pipeline. */

const IMAGE_MIME = /^image\//;

export function isImageFile(file: File): boolean {
  return IMAGE_MIME.test(file.type);
}

/** Load a File into an HTMLImageElement, resolving once decoded. */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image."));
    img.src = src;
  });
}

/**
 * Decode a File to an ImageBitmap when supported (off-main-thread decode),
 * falling back to an HTMLImageElement. Both are valid `drawImage` sources.
 */
export async function decodeToDrawable(
  file: File,
): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return bitmap;
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(url);
    return Object.assign(img, {
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Read a File's intrinsic dimensions without keeping the element around. */
export async function readNaturalSize(
  file: File,
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(url);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

let idCounter = 0;
/** Stable, collision-resistant id without pulling in a uuid dependency. */
export function makeId(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}
