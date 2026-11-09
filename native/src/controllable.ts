import { useCallback, useRef, useState } from 'react';

/** A value that the parent can own, or leave to the component, as React's own inputs work. */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (value: T) => void) {
  const [own, setOwn] = useState(defaultValue);
  const controlled = useRef(value !== undefined).current;
  const current = controlled ? (value as T) : own;
  const set = useCallback(
    (next: T) => {
      if (!controlled) setOwn(next);
      onChange?.(next);
    },
    [controlled, onChange]
  );
  return [current, set] as const;
}
