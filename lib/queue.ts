/**
 * A tiny promise-pool that runs `worker` over `items` with bounded concurrency,
 * reporting progress as each task settles. Yielding to the event loop between
 * task dispatches keeps the UI responsive during heavy canvas work.
 */

export interface QueueProgress {
  completed: number;
  total: number;
  /** Index of the item that just settled. */
  index: number;
  error?: Error;
}

export async function runConcurrent<T>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency = 3,
  onProgress?: (progress: QueueProgress) => void,
): Promise<void> {
  const total = items.length;
  if (total === 0) return;

  let nextIndex = 0;
  let completed = 0;
  const limit = Math.max(1, Math.min(concurrency, total));

  const runLane = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) return;

      let error: Error | undefined;
      try {
        await worker(items[index], index);
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
      }

      completed += 1;
      onProgress?.({ completed, total, index, error });

      // Hand the main thread back a frame so React can paint progress.
      await yieldToEventLoop();
    }
  };

  await Promise.all(Array.from({ length: limit }, runLane));
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
