import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { ColorWell } from "../src";

const well = () => screen.getByRole("button", { name: "Color" });
const open = () => fireEvent.click(well());
const mode = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));
const fillOf = () => well().style.getPropertyValue("--lg-well-color");

afterEach(() => {
  delete (window as unknown as { EyeDropper?: unknown }).EyeDropper;
});

test("is a round button that shows its colour", () => {
  render(<ColorWell value="#ff3b30" />);
  expect(well().getAttribute("aria-haspopup")).toBe("dialog");
  expect(well().getAttribute("aria-expanded")).toBe("false");
  expect(fillOf()).toBe("rgb(255 59 48 / 1)");
});

test("shows the colour's opacity", () => {
  render(<ColorWell value="#0088ff80" />);
  expect(fillOf()).toBe("rgb(0 136 255 / 0.5)");
});

test("never writes a string it was given into a style", () => {
  const hostile = "#fff;background:url(javascript:alert(1))";
  render(<ColorWell value={hostile} swatches={[hostile, "red", "#34c759"]} />);
  open();
  expect(fillOf()).toBe("rgb(0 136 255 / 1)");
  const markup = document.documentElement.innerHTML;
  expect(markup).not.toContain("javascript");
  expect(markup).not.toContain("alert(1)");
  // Of the swatches, only the one that is a colour is drawn.
  const swatches = screen.getByRole("group", { name: "Swatches" });
  expect(swatches.querySelectorAll("button")).toHaveLength(1);
  expect(swatches.querySelector("button")!.getAttribute("aria-label")).toBe("#34c759");
});

test("opens the picker, and closes it again", () => {
  render(<ColorWell value="#ff3b30" title="Pick one" />);
  expect(screen.queryByRole("heading", { name: "Pick one" })).toBeNull();
  open();
  expect(screen.getByRole("heading", { name: "Pick one" })).toBeTruthy();
  expect(well().getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(well().getAttribute("aria-expanded")).toBe("false");
});

test("lets the caller's click stop it opening", () => {
  render(<ColorWell onClick={(event) => event.preventDefault()} />);
  open();
  expect(well().getAttribute("aria-expanded")).toBe("false");
});

test("picks a colour from the grid and keeps the opacity", () => {
  const onValueChange = vi.fn();
  render(<ColorWell defaultValue="#0088ff80" onValueChange={onValueChange} />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "#ffffff" }));
  expect(onValueChange).toHaveBeenLastCalledWith("#ffffff80");
  expect(fillOf()).toBe("rgb(255 255 255 / 0.5)");
});

test("marks the grid's colour that is chosen, and keeps one tab stop", () => {
  render(<ColorWell value="#ffffff" />);
  open();
  const cells = screen.getByRole("group", { name: "Grid" }).querySelectorAll("button");
  expect(cells).toHaveLength(120);
  expect(screen.getByRole("button", { name: "#ffffff" }).getAttribute("aria-pressed")).toBe("true");
  expect([...cells].filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
});

test("moves round the grid with the arrow keys", () => {
  render(<ColorWell value="#ffffff" />);
  open();
  const grid = screen.getByRole("group", { name: "Grid" });
  const cells = grid.querySelectorAll("button");
  cells[0]!.focus();
  fireEvent.keyDown(cells[0]!, { key: "ArrowRight" });
  expect(document.activeElement).toBe(cells[1]);
  fireEvent.keyDown(cells[1]!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(cells[11]);
  fireEvent.keyDown(cells[11]!, { key: "End" });
  expect(document.activeElement).toBe(cells[119]);
  fireEvent.keyDown(cells[119]!, { key: "ArrowRight" });
  expect(document.activeElement).toBe(cells[119]);
  fireEvent.keyDown(cells[119]!, { key: "Home" });
  expect(document.activeElement).toBe(cells[0]);
});

function spectrum() {
  mode("Spectrum");
  const area = screen.getByRole("group", { name: "Spectrum" });
  area.getBoundingClientRect = () => ({ left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250, x: 100, y: 50, toJSON() {} }) as DOMRect;
  return area;
}

test("picks from the spectrum under a finger, and follows it as it drags", () => {
  const onValueChange = vi.fn();
  render(<ColorWell defaultValue="#000000" supportsAlpha={false} onValueChange={onValueChange} />);
  open();
  const area = spectrum();
  // The left edge, halfway down, is the full red; halfway across it is the full cyan.
  fireEvent.pointerDown(area, { pointerId: 1, clientX: 100, clientY: 150 });
  expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
  fireEvent.pointerMove(area, { pointerId: 1, clientX: 300, clientY: 150 });
  expect(onValueChange).toHaveBeenLastCalledWith("#00ffff");
  fireEvent.pointerMove(area, { pointerId: 1, clientX: 300, clientY: 250 });
  expect(onValueChange).toHaveBeenLastCalledWith("#000000");
  fireEvent.pointerUp(area, { pointerId: 1, clientX: 300, clientY: 250 });
  onValueChange.mockClear();
  fireEvent.pointerMove(area, { pointerId: 1, clientX: 300, clientY: 50 });
  expect(onValueChange).not.toHaveBeenCalled();
});

test("stays inside the spectrum when a drag leaves it", () => {
  const onValueChange = vi.fn();
  render(<ColorWell defaultValue="#000000" onValueChange={onValueChange} />);
  open();
  const area = spectrum();
  fireEvent.pointerDown(area, { pointerId: 1, clientX: 5000, clientY: -300 });
  expect(onValueChange).toHaveBeenLastCalledWith("#ffffff");
});

test("moves across the spectrum with the arrow keys", () => {
  const onValueChange = vi.fn();
  render(<ColorWell defaultValue="#ff0000" supportsAlpha={false} onValueChange={onValueChange} />);
  open();
  const area = spectrum();
  fireEvent.keyDown(area, { key: "ArrowRight", shiftKey: true });
  // A tenth of the way round the hues is 36 degrees: orange-yellow.
  expect(onValueChange).toHaveBeenLastCalledWith("#ff9900");
  fireEvent.keyDown(area, { key: "ArrowLeft", shiftKey: true });
  expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
  fireEvent.keyDown(area, { key: "a" });
  expect(onValueChange).toHaveBeenCalledTimes(2);
});

test("keeps its hue while the colour passes through white", () => {
  render(<ColorWell defaultValue="#00ff00" supportsAlpha={false} />);
  open();
  mode("Sliders");
  // Red up makes yellow, and blue up after it makes white. White has no hue of its own, so the
  // picker keeps yellow's, a sixth of the way across, rather than snapping back to red.
  fireEvent.change(screen.getByRole("slider", { name: "Red" }), { target: { value: "255" } });
  fireEvent.change(screen.getByRole("slider", { name: "Blue" }), { target: { value: "255" } });
  expect(fillOf()).toBe("rgb(255 255 255 / 1)");
  mode("Spectrum");
  const thumb = screen.getByRole("group", { name: "Spectrum" }).querySelector<HTMLElement>(".lg-color-spectrum-thumb")!;
  expect(parseFloat(thumb.style.left)).toBeCloseTo(100 / 6, 5);
  expect(thumb.style.top).toBe("0%");
});

test("sets each channel with a slider", () => {
  const onValueChange = vi.fn();
  render(<ColorWell defaultValue="#102030" supportsAlpha={false} onValueChange={onValueChange} />);
  open();
  mode("Sliders");
  expect((screen.getByRole("slider", { name: "Red" }) as HTMLInputElement).value).toBe("16");
  expect((screen.getByRole("slider", { name: "Green" }) as HTMLInputElement).value).toBe("32");
  fireEvent.change(screen.getByRole("slider", { name: "Blue" }), { target: { value: "255" } });
  expect(onValueChange).toHaveBeenLastCalledWith("#1020ff");
  fireEvent.change(screen.getByRole("slider", { name: "Red" }), { target: { value: "0" } });
  expect(onValueChange).toHaveBeenLastCalledWith("#0020ff");
});

test("takes a hex colour typed in, once it's finished", () => {
  const onValueChange = vi.fn();
  render(<ColorWell defaultValue="#102030" onValueChange={onValueChange} />);
  open();
  mode("Sliders");
  const hex = screen.getByRole("textbox", { name: "Hex" }) as HTMLInputElement;
  expect(hex.value).toBe("#102030");
  fireEvent.change(hex, { target: { value: "#00ff0" } });
  // Half typed isn't a colour, and nothing is chosen yet.
  expect(hex.getAttribute("aria-invalid")).toBe("true");
  expect(onValueChange).not.toHaveBeenCalled();
  fireEvent.change(hex, { target: { value: "34c759" } });
  expect(hex.getAttribute("aria-invalid")).toBeNull();
  fireEvent.keyDown(hex, { key: "Enter" });
  expect(onValueChange).toHaveBeenLastCalledWith("#34c759");
  expect(hex.value).toBe("#34c759");
});

test("puts the colour back when what was typed isn't one", () => {
  const onValueChange = vi.fn();
  render(<ColorWell defaultValue="#102030" onValueChange={onValueChange} />);
  open();
  mode("Sliders");
  const hex = screen.getByRole("textbox", { name: "Hex" }) as HTMLInputElement;
  fireEvent.change(hex, { target: { value: "javascript:1" } });
  fireEvent.blur(hex);
  expect(onValueChange).not.toHaveBeenCalled();
  expect(hex.value).toBe("#102030");
});

test("sets the opacity, and offers it only when asked", () => {
  const onValueChange = vi.fn();
  const { rerender } = render(<ColorWell defaultValue="#0088ff" onValueChange={onValueChange} />);
  open();
  const opacity = screen.getByRole("slider", { name: "Opacity" }) as HTMLInputElement;
  expect(opacity.value).toBe("100");
  fireEvent.change(opacity, { target: { value: "50" } });
  expect(onValueChange).toHaveBeenLastCalledWith("#0088ff80");
  expect(screen.getByText("50%")).toBeTruthy();
  fireEvent.change(opacity, { target: { value: "0" } });
  expect(onValueChange).toHaveBeenLastCalledWith("#0088ff00");
  rerender(<ColorWell defaultValue="#0088ff" supportsAlpha={false} onValueChange={onValueChange} />);
  expect(screen.queryByRole("slider", { name: "Opacity" })).toBeNull();
});

test("without opacity, a see-through colour is made solid", () => {
  render(<ColorWell value="#0088ff80" supportsAlpha={false} />);
  expect(fillOf()).toBe("rgb(0 136 255 / 1)");
});

test("follows a controlled value, and gives way when the owner doesn't change it", () => {
  const onValueChange = vi.fn();
  const { rerender } = render(<ColorWell value="#ff0000" onValueChange={onValueChange} />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "#ffffff" }));
  expect(onValueChange).toHaveBeenLastCalledWith("#ffffff");
  expect(fillOf()).toBe("rgb(255 0 0 / 1)");
  expect(screen.getByRole("button", { name: "#ffffff" }).getAttribute("aria-pressed")).toBe("false");
  rerender(<ColorWell value="#00ff00" onValueChange={onValueChange} />);
  expect(fillOf()).toBe("rgb(0 255 0 / 1)");
  mode("Sliders");
  expect((screen.getByRole("slider", { name: "Green" }) as HTMLInputElement).value).toBe("255");
});

test("picks a swatch", () => {
  const onValueChange = vi.fn();
  render(<ColorWell defaultValue="#000000" swatches={["#ff9500", "#5ac8fa80"]} onValueChange={onValueChange} />);
  open();
  const swatches = screen.getByRole("group", { name: "Swatches" });
  fireEvent.click(swatches.querySelectorAll("button")[1]!);
  expect(onValueChange).toHaveBeenLastCalledWith("#5ac8fa80");
  fireEvent.click(screen.getByRole("button", { name: "#ff9500" }));
  expect(onValueChange).toHaveBeenLastCalledWith("#ff9500");
});

test("shows no swatches when there are none", () => {
  render(<ColorWell />);
  open();
  expect(screen.queryByRole("group", { name: "Swatches" })).toBeNull();
});

test("offers the eyedropper only where the browser has one, and takes its colour", async () => {
  const { unmount } = render(<ColorWell />);
  open();
  expect(screen.queryByRole("button", { name: /from the screen/ })).toBeNull();
  unmount();

  const onValueChange = vi.fn();
  const sample = vi.fn().mockResolvedValue({ sRGBHex: "#34c759" });
  (window as unknown as { EyeDropper: unknown }).EyeDropper = class {
    open = sample;
  };
  render(<ColorWell defaultValue="#0088ff80" onValueChange={onValueChange} />);
  open();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /from the screen/ }));
  });
  expect(onValueChange).toHaveBeenLastCalledWith("#34c75980");
});

test("an eyedropper that is dismissed, or answers with nonsense, changes nothing", async () => {
  const onValueChange = vi.fn();
  const answers = [Promise.reject(new DOMException("closed", "AbortError")), Promise.resolve({ sRGBHex: "url(javascript:1)" })];
  (window as unknown as { EyeDropper: unknown }).EyeDropper = class {
    open = () => answers.shift()!;
  };
  render(<ColorWell onValueChange={onValueChange} />);
  open();
  for (let times = 0; times < 2; times++)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /from the screen/ }));
    });
  expect(onValueChange).not.toHaveBeenCalled();
});

test("passes its other props to the button", () => {
  render(<ColorWell aria-label="Fill" data-testid="well" disabled className="mine" />);
  const button = screen.getByRole("button", { name: "Fill" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.className).toContain("lg-color-well");
  expect(button.className).toContain("mine");
  expect(button.type).toBe("button");
});
