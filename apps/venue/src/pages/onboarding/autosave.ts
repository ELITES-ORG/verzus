import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'waiting' | 'saving' | 'saved' | 'error';

/**
 * Autosave for an onboarding step. Saves `data` a moment after it stops changing, but only while
 * `ready` (the step's data is complete and valid: a half-typed phone number never overwrites a
 * good one). Saves never overlap: a change made while one is running is saved right after it.
 * Whatever is still unsaved when the step closes (Back, the progress bar, the logo) is saved then.
 *
 * `flush()` saves now and resolves true once everything is saved: Continue awaits it.
 * `saved`: what the database already holds, in the same shape as `data`. Defaults to the data's
 * first value; pass it when the step fills in after opening (so that isn't saved again).
 */
export function useAutosave<T>(
  data: T,
  ready: boolean,
  save: (data: T) => Promise<void>,
  { saved, delay = 800 }: { saved?: T; delay?: number } = {},
) {
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(data);
  latest.current = data;
  const readyNow = useRef(ready);
  readyNow.current = ready;
  const saveNow = useRef(save);
  saveNow.current = save;
  const savedJson = useRef(JSON.stringify(saved ?? data));
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reads refs only, so it never changes.
  const dirty = useCallback(() => JSON.stringify(latest.current) !== savedJson.current, []);

  /** Saves the latest data if it's ready and changed; runs again if it changed meanwhile. */
  const run = useCallback(async (): Promise<boolean> => {
    if (running.current) {
      await running.current;
      return run();
    }
    if (!dirty()) return true;
    if (!readyNow.current) return false;
    const snapshot = latest.current;
    const json = JSON.stringify(snapshot);
    setState('saving');
    const job = (async () => {
      try {
        await saveNow.current(snapshot);
        savedJson.current = json;
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save.');
        return false;
      }
    })();
    running.current = job;
    const ok = await job;
    running.current = null;
    if (!ok) {
      setState('error');
      return false;
    }
    if (dirty()) return run(); // changed while saving
    setState('saved');
    return true;
  }, [dirty]);

  // A moment after the data stops changing.
  const json = JSON.stringify(data);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the data's content.
  useEffect(() => {
    if (json === savedJson.current) return;
    setState(ready ? 'waiting' : 'idle');
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [json, ready]);

  // Leaving the step: save what's left (fire and forget; the step is gone).
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty() && readyNow.current) void run();
    },
    [run, dirty],
  );

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return run();
  }, [run]);

  return { state, error, flush, unsaved: json !== savedJson.current };
}

/**
 * The bottom bar's save status: "Saving…", "✓ Saved", or "Not saved" when a save failed. Nothing
 * for an incomplete step: the step itself shows what's missing (its fields, a disabled Continue).
 */
export function saveLabel(state: SaveState): string | null {
  if (state === 'saving' || state === 'waiting') return 'Saving…';
  if (state === 'error') return 'Not saved';
  if (state === 'saved') return '✓ Saved';
  return null;
}
