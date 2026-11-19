import { useEffect, useId, useRef, type JSX, type KeyboardEvent, type ReactNode } from "react";

import type { AlertAction } from "./alert";
import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion, useModal } from "./internal/modal";
import { fitRim } from "./internal/refraction";
import { useStyles } from "./internal/styles";
import actionSheetCss from "./styles/action-sheet.css?inline";
import layerCss from "./styles/layer.css?inline";

export interface ActionSheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: ReactNode;
  message?: ReactNode;
  /**
   * What can be chosen, from the top. The `cancel` action goes in a card of its
   * own below the rest, and is also what Escape and a tap outside do.
   */
  actions: AlertAction[];
  className?: string;
  /** Names the sheet when it has no `title`. */
  "aria-label"?: string;
}

const LEAVE_MS = 240;

/**
 * The iOS action sheet: a short list of choices that comes up from the bottom as
 * floating glass, with Cancel apart from the rest. Closes when an action is chosen
 * or when the screen around it is tapped.
 */
export function ActionSheet({ open: openProp, defaultOpen = false, onOpenChange, title, message, actions, className, "aria-label": label }: ActionSheetProps): JSX.Element {
  useStyles(["layer", layerCss], ["action-sheet", actionSheetCss]);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const cancel = actions.find((action) => action.role === "cancel");
  const choices = actions.filter((action) => action !== cancel);
  const dismiss = () => {
    cancel?.onSelect?.();
    setOpen(false);
  };
  const { phase, finished } = useModal(dialogRef, open, dismiss);
  const done = useRef(finished);
  useEffect(() => {
    done.current = finished;
  });

  const shown = phase !== "closed";
  const hasCancel = cancel !== undefined;
  useEffect(() => {
    if (!shown) return;
    const stops = [listRef.current, cancelRef.current].filter((card) => card !== null).map((card) => fitRim(card));
    return () => stops.forEach((stop) => stop());
  }, [shown, hasCancel]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => done.current(), reducedMotion() ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Up and down move between the choices, which Tab does too.
  const move = (event: KeyboardEvent<HTMLDialogElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const rows = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".lg-action-sheet-action")];
    if (!rows.length) return;
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : event.key === "ArrowDown" ? Math.min(at + 1, rows.length - 1) : at < 0 ? rows.length - 1 : Math.max(at - 1, 0);
    event.preventDefault();
    rows[next]!.focus();
  };

  const row = (action: AlertAction, index: number) => (
    <button
      key={index}
      type="button"
      className="lg-action-sheet-action"
      data-destructive={action.role === "destructive" ? "" : undefined}
      data-cancel={action === cancel ? "" : undefined}
      onClick={() => {
        action.onSelect?.();
        setOpen(false);
      }}
    >
      {action.label}
    </button>
  );

  const titled = title != null;
  const described = message != null;
  return (
    <dialog
      ref={dialogRef}
      className={cx("lg-modal lg-action-sheet", className)}
      data-phase={phase}
      aria-labelledby={titled ? `${id}-title` : undefined}
      aria-label={titled ? undefined : label}
      aria-describedby={described ? `${id}-message` : undefined}
      onKeyDown={move}
    >
      {shown ? (
        <>
          <span className="lg-modal-scrim" aria-hidden onClick={() => phase === "open" && dismiss()} />
          <div className="lg-action-sheet-stack">
            <div ref={listRef} className="lg-glass lg-action-sheet-card">
              <div className="lg-action-sheet-body">
                {titled || described ? (
                  <div className="lg-action-sheet-header">
                    {titled ? (
                      <h2 id={`${id}-title`} className="lg-action-sheet-title">
                        {title}
                      </h2>
                    ) : null}
                    {described ? (
                      <p id={`${id}-message`} className="lg-action-sheet-message">
                        {message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {choices.map(row)}
              </div>
            </div>
            {cancel ? (
              <div ref={cancelRef} className="lg-glass lg-action-sheet-card">
                <div className="lg-action-sheet-body">{row(cancel, choices.length)}</div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
