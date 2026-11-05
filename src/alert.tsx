import { useEffect, useRef, type JSX, type ReactNode } from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion, useModal } from "./internal/modal";
import { fitRim } from "./internal/refraction";

export interface AlertAction {
  label: ReactNode;
  /** `cancel` is also what Escape does. `destructive` is red. */
  role?: "cancel" | "destructive";
  onSelect?: () => void;
}

export interface AlertProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  message?: ReactNode;
  actions: AlertAction[];
  className?: string;
}

const LEAVE_MS = 120;

/** The iOS alert: a modal question with a row of pill buttons. Closes when an action is chosen. */
export function Alert({ open: openProp, defaultOpen = false, onOpenChange, title, message, actions, className }: AlertProps): JSX.Element {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cancel = actions.find((action) => action.role === "cancel");
  const { phase, finished } = useModal(dialogRef, open, () => {
    cancel?.onSelect?.();
    setOpen(false);
  });
  const done = useRef(finished);
  useEffect(() => {
    done.current = finished;
  });

  useEffect(() => {
    if (phase === "closed") return;
    return fitRim(cardRef.current!);
  }, [phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => done.current(), reducedMotion() ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const describedBy = message == null ? undefined : "lg-alert-message";
  return (
    <dialog ref={dialogRef} className={cx("lg-modal lg-alert", className)} data-phase={phase} aria-labelledby="lg-alert-title" aria-describedby={describedBy}>
      {phase === "closed" ? null : (
        <>
          <span className="lg-modal-scrim" aria-hidden />
          <div ref={cardRef} className="lg-glass lg-alert-card">
            <div className="lg-alert-text">
              <h2 id="lg-alert-title" className="lg-alert-title">
                {title}
              </h2>
              {message == null ? null : (
                <p id={describedBy} className="lg-alert-message">
                  {message}
                </p>
              )}
            </div>
            <div className="lg-alert-actions" data-stacked={actions.length > 2 ? "" : undefined}>
              {actions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  className="lg-alert-action"
                  data-destructive={action.role === "destructive" ? "" : undefined}
                  onClick={() => {
                    action.onSelect?.();
                    setOpen(false);
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
