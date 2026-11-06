import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type ModalPhase = "closed" | "open" | "leaving";

/**
 * Keeps a <dialog> in the top layer from when `open` turns true until `finished`
 * is called after it turns false, so it has time to animate out.
 */
export function useModal(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  requestClose: () => void,
): { phase: ModalPhase; finished: () => void } {
  const [phase, setPhase] = useState<ModalPhase>(open ? "open" : "closed");
  const close = useRef(requestClose);
  useEffect(() => {
    close.current = requestClose;
  });

  useLayoutEffect(() => {
    setPhase((now) => (open ? "open" : now === "closed" ? "closed" : "leaving"));
  }, [open]);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || phase !== "open" || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    // The browser would focus the first button and may ring it, which iOS never
    // does. The dialog takes focus instead, and Tab goes on to the first button.
    dialog.tabIndex = -1;
    dialog.focus({ preventScroll: true });
  }, [phase, ref]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Escape asks to close, so a controlled owner can refuse and the exit still animates.
    const cancel = (event: Event) => {
      event.preventDefault();
      close.current();
    };
    dialog.addEventListener("cancel", cancel);
    return () => dialog.removeEventListener("cancel", cancel);
  }, [ref, phase]);

  const finished = () => {
    const dialog = ref.current;
    if (typeof dialog?.close === "function" && dialog.open) dialog.close();
    else dialog?.removeAttribute("open");
    setPhase("closed");
  };

  return { phase, finished };
}

export const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
