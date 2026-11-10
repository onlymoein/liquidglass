import { useCallback, useEffect, useState } from 'react';

/**
 * A value that the parent can own, or leave to the component, as React's own inputs work. Whether
 * the parent owns it is decided afresh on every render: a parent that stops passing a value leaves
 * the component where it was, and one that starts passing one takes over.
 */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (value: T) => void) {
  const [own, setOwn] = useState(defaultValue);
  const controlled = value !== undefined;
  // Kept in step with the parent's value, so letting go of it carries on from there.
  useEffect(() => {
    if (controlled) setOwn(value as T);
  }, [controlled, value]);
  const current = controlled ? (value as T) : own;
  const set = useCallback(
    (next: T) => {
      if (!controlled) setOwn(next);
      onChange?.(next);
    },
    [controlled, onChange]
  );
  return [current, set, controlled] as const;
}
