export type DebouncedFunction<TArgs extends unknown[]> = ((
  ...args: TArgs
) => void) & {
  cancel: () => void;
  flush: () => void;
};

export function debounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  waitMs: number,
): DebouncedFunction<TArgs> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  const run = (...args: TArgs) => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;

      if (!lastArgs) {
        return;
      }

      callback(...lastArgs);
      lastArgs = null;
    }, waitMs);
  };

  run.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    lastArgs = null;
  };

  run.flush = () => {
    if (!lastArgs) {
      return;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    callback(...lastArgs);
    lastArgs = null;
  };

  return run;
}
