import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Alert } from "../src";

const dialog = () => document.querySelector("dialog")!;

test("shows nothing until it's open", () => {
  render(<Alert title="Delete?" actions={[{ label: "Cancel", role: "cancel" }]} />);
  expect(screen.queryByText("Delete?")).toBeNull();
  expect(dialog().hasAttribute("open")).toBe(false);
});

test("runs the chosen action, then closes after animating out", () => {
  vi.useFakeTimers();
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <Alert
      defaultOpen
      onOpenChange={onOpenChange}
      title="Delete?"
      message="It can't be undone."
      actions={[{ label: "Cancel", role: "cancel" }, { label: "Delete", role: "destructive", onSelect }]}
    />,
  );
  expect(screen.getByText("It can't be undone.")).toBeTruthy();
  fireEvent.click(screen.getByText("Delete"));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(dialog().dataset.phase).toBe("leaving");
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(dialog().dataset.phase).toBe("closed");
  vi.useRealTimers();
});

test("takes focus itself, so no button comes up ringed as it opens", () => {
  render(<Alert defaultOpen title="Delete?" actions={[{ label: "Cancel", role: "cancel" }]} />);
  expect(document.activeElement).toBe(dialog());
});

test("Escape runs the cancel action", () => {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(<Alert open onOpenChange={onOpenChange} title="Delete?" actions={[{ label: "Cancel", role: "cancel", onSelect }]} />);
  fireEvent(dialog(), new Event("cancel", { cancelable: true }));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("marks a destructive action and stacks more than two", () => {
  render(<Alert open title="Delete?" actions={[{ label: "A" }, { label: "B", role: "destructive" }, { label: "C" }]} />);
  expect(screen.getByText("B").hasAttribute("data-destructive")).toBe(true);
  expect(document.querySelector(".lg-alert-actions")?.hasAttribute("data-stacked")).toBe(true);
});

test("draws the preferred action filled, and a disabled one can't be chosen", () => {
  const save = vi.fn();
  render(
    <Alert
      open
      title="Save?"
      actions={[{ label: "Cancel", role: "cancel" }, { label: "Later", disabled: true, onSelect: save }, { label: "Save", preferred: true }]}
    />,
  );
  expect(screen.getByText("Save").hasAttribute("data-preferred")).toBe(true);
  expect(screen.getByText("Cancel").hasAttribute("data-preferred")).toBe(false);
  expect((screen.getByText("Later") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByText("Later"));
  expect(save).not.toHaveBeenCalled();
});

test("fields: the first takes focus, and the action gets what was typed", () => {
  const rename = vi.fn();
  render(
    <Alert
      open
      title="Rename"
      fields={[{ placeholder: "Name", defaultValue: "Box" }, { placeholder: "Note", type: "password" }]}
      actions={[{ label: "Cancel", role: "cancel" }, { label: "Save", preferred: true, onSelect: rename }]}
    />,
  );
  const name = screen.getByLabelText("Name") as HTMLInputElement;
  const note = screen.getByLabelText("Note") as HTMLInputElement;
  expect(document.activeElement).toBe(name);
  expect(name.value).toBe("Box");
  expect(note.type).toBe("password");
  fireEvent.change(name, { target: { value: "Pallet" } });
  fireEvent.change(note, { target: { value: "fragile" } });
  fireEvent.click(screen.getByText("Save"));
  expect(rename).toHaveBeenCalledWith(["Pallet", "fragile"]);
});

test("fields: Escape runs the cancel action with the values, and reopening starts from the defaults", () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const { rerender } = render(
    <Alert open title="Rename" fields={[{ placeholder: "Name", defaultValue: "Box" }]} actions={[{ label: "Cancel", role: "cancel", onSelect: cancel }]} />,
  );
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Pallet" } });
  fireEvent(dialog(), new Event("cancel", { cancelable: true }));
  expect(cancel).toHaveBeenCalledWith(["Pallet"]);
  const props = { title: "Rename", fields: [{ placeholder: "Name", defaultValue: "Box" }], actions: [{ label: "Cancel", role: "cancel" as const }] };
  rerender(<Alert open={false} {...props} />);
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(dialog().dataset.phase).toBe("closed");
  rerender(<Alert open {...props} />);
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Box");
  vi.useRealTimers();
});

test("Return in a field chooses the preferred action, never a disabled or a missing one", () => {
  const save = vi.fn();
  const { rerender } = render(
    <Alert open title="Rename" fields={[{ placeholder: "Name" }]} actions={[{ label: "Cancel", role: "cancel" }, { label: "Save", preferred: true, onSelect: save }]} />,
  );
  fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
  expect(save).toHaveBeenCalledTimes(1);
  rerender(<Alert open title="Rename" fields={[{ placeholder: "Name" }]} actions={[{ label: "Save", preferred: true, disabled: true, onSelect: save }]} />);
  fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
  expect(save).toHaveBeenCalledTimes(1);
  rerender(<Alert open title="Rename" fields={[{ placeholder: "Name" }]} actions={[{ label: "Save", onSelect: save }]} />);
  fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
  expect(save).toHaveBeenCalledTimes(1);
});

test("Return on a button leaves it to the button's own click", () => {
  const save = vi.fn();
  render(<Alert open title="Save?" actions={[{ label: "Cancel", role: "cancel" }, { label: "Save", preferred: true, onSelect: save }]} />);
  fireEvent.keyDown(screen.getByText("Cancel"), { key: "Enter" });
  expect(save).not.toHaveBeenCalled();
});

test("an alert without fields is as before", () => {
  render(<Alert open title="Delete?" actions={[{ label: "Cancel", role: "cancel" }]} />);
  expect(document.querySelector(".lg-alert-fields")).toBeNull();
  expect(document.querySelector(".lg-alert-card")?.hasAttribute("data-fields")).toBe(false);
});
