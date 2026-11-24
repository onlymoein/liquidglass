import { useEffect, useRef, useState, type JSX, type KeyboardEvent, type ReactNode } from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion, useModal } from "./internal/modal";
import { fitRim } from "./internal/refraction";
import { useStyles } from "./internal/styles";
import menuCss from "./styles/menu.css?inline";
import segmentedControlCss from "./styles/segmented-control.css?inline";
import layerCss from "./styles/layer.css?inline";
import alertCss from "./styles/alert.css?inline";

export interface AlertAction {
  label: ReactNode;
  /** `cancel` is also what Escape does. `destructive` is red. */
  role?: "cancel" | "destructive";
  /** What Return chooses: drawn filled in the accent colour, in semibold, as iOS draws it. */
  preferred?: boolean;
  disabled?: boolean;
  /** `values` is what's typed in each of the alert's `fields`, in order. */
  onSelect?: (values: string[]) => void;
}

/** A line of text to fill in, set in the card above the buttons. */
export interface AlertField {
  placeholder?: string;
  defaultValue?: string;
  type?: "text" | "password" | "email" | "number" | "url" | "tel" | "search";
  autoComplete?: string;
  /** Read out in place of the placeholder. */
  "aria-label"?: string;
}

export interface AlertProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  message?: ReactNode;
  actions: AlertAction[];
  /** Text fields under the message. The first takes focus as the alert opens; each starts again from its `defaultValue` the next time it opens. */
  fields?: AlertField[];
  className?: string;
}

const LEAVE_MS = 120;

const initial = (fields: AlertField[]) => fields.map((field) => field.defaultValue ?? "");

/** The iOS alert: a modal question with a row of pill buttons, and text fields if it needs an answer. Closes when an action is chosen. */
export function Alert({ open: openProp, defaultOpen = false, onOpenChange, title, message, actions, fields = [], className }: AlertProps): JSX.Element {
  useStyles(["menu", menuCss], ["segmented-control", segmentedControlCss], ["layer", layerCss], ["alert", alertCss]);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cancel = actions.find((action) => action.role === "cancel");
  const preferred = actions.find((action) => action.preferred && !action.disabled);
  const [values, setValues] = useState(() => initial(fields));
  const choose = (action: AlertAction) => {
    action.onSelect?.(values);
    setOpen(false);
  };
  const { phase, finished } = useModal(dialogRef, open, () => {
    cancel?.onSelect?.(values);
    setOpen(false);
  });
  const done = useRef(finished);
  useEffect(() => {
    done.current = finished;
  });

  // Fields start from their defaults each time the alert opens.
  const closed = phase === "closed";
  useEffect(() => {
    if (closed) setValues(initial(fields));
  }, [closed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (closed) return;
    // As on iOS, the first field is ready to type in. Alerts without one leave focus on the dialog.
    cardRef.current!.querySelector<HTMLInputElement>(".lg-alert-field")?.focus({ preventScroll: true });
    return fitRim(cardRef.current!);
  }, [closed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Return chooses the preferred action, from a field or from the dialog itself. On a button it clicks that button.
  const enter = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || !preferred) return;
    if ((event.target as Element).closest("button")) return;
    event.preventDefault();
    choose(preferred);
  };

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => done.current(), reducedMotion() ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const describedBy = message == null ? undefined : "lg-alert-message";
  return (
    <dialog ref={dialogRef} className={cx("lg-modal lg-alert", className)} data-phase={phase} aria-labelledby="lg-alert-title" aria-describedby={describedBy} onKeyDown={enter}>
      {phase === "closed" ? null : (
        <>
          <span className="lg-modal-scrim" aria-hidden />
          <div ref={cardRef} className="lg-glass lg-alert-card" data-fields={fields.length ? "" : undefined}>
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
            {fields.length === 0 ? null : (
              <div className="lg-alert-fields">
                {fields.map((field, index) => (
                  <div key={index} className="lg-alert-field-row">
                    <input
                      className="lg-alert-field"
                      type={field.type ?? "text"}
                      placeholder={field.placeholder}
                      autoComplete={field.autoComplete}
                      aria-label={field["aria-label"] ?? field.placeholder}
                      value={values[index] ?? ""}
                      onChange={(event) => {
                        const typed = event.currentTarget.value;
                        setValues((now) => fields.map((_, at) => (at === index ? typed : (now[at] ?? ""))));
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="lg-alert-actions" data-stacked={actions.length > 2 ? "" : undefined}>
              {actions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  className="lg-alert-action"
                  data-destructive={action.role === "destructive" ? "" : undefined}
                  data-preferred={action.preferred ? "" : undefined}
                  disabled={action.disabled}
                  onClick={() => choose(action)}
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
