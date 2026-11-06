import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Alert, Button, Glass, GlassGroup, Menu, SearchField, Progress, SegmentedControl, Sheet, Slider, Spinner, Stepper, Switch, TabBar, Toolbar, ToolbarGroup } from "../../dist/index.js";

const q = new URLSearchParams(location.search);
const get = (name: string, fallback: string) => q.get(name) || fallback;
const num = (name: string, fallback: number) => Number(q.get(name)) || fallback;
const bg = get("bg", "ffffff");
const hex = /^[0-9a-f]{6}$/i.test(bg);
const edge = num("edge", 0);

function Element() {
  const [on, setOn] = useState(true);
  const w = num("w", 300), h = num("h", 120), r = num("r", 28);
  switch (get("kind", "regular")) {
    case "regular": return <Glass style={{ width: w, height: h, borderRadius: r }} />;
    case "button": return <Button>Continue</Button>;
    case "button-large": return <Button size="large">Continue</Button>;
    case "filled": return <Button variant="filled">Continue</Button>;
    case "filled-large": return <Button variant="filled" size="large">Continue</Button>;
    case "switch": return <Switch aria-label="On" checked={on} onCheckedChange={setOn} />;
    case "slider": return <div style={{ width: w }}><Slider aria-label="Value" defaultValue={50} min={0} max={100} /></div>;
    default: return null;
  }
}

const row = { height: 60, display: "flex", alignItems: "center", justifyContent: "center" } as const;
function All() {
  const [on, setOn] = useState(true);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 90 }}>
      <div style={{ ...row, height: 120 }}><Glass style={{ width: 300, height: 90, borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lg-foreground)" }}>Glass panel</Glass></div>
      <div style={row}><Button>Continue</Button></div>
      <div style={row}><Button variant="filled">Continue</Button></div>
      <div style={row}><Button size="large">Continue</Button></div>
      <div style={row}><Button variant="filled" size="large">Continue</Button></div>
      <div style={row}><Switch aria-label="On" checked={on} onCheckedChange={setOn} /></div>
      <div style={row}><div style={{ width: 300 }}><Slider aria-label="Value" defaultValue={50} min={0} max={100} /></div></div>
      <div style={row}><Glass style={{ "--lg-transparency": 1, width: 300, height: 60, borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lg-foreground)" } as never}>Clear glass</Glass></div>
    </div>
  );
}

const icon = (d: string) => <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden><path d={d} /></svg>;
const tabs = [
  { value: "home", label: "Home", icon: icon("M12 2.2 16.6 6V3.6h2.6v4.5l3.4 2.8-1.2 1.5-1.4-1.1v8.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8.2l-1.4 1.1-1.2-1.5zM10 21h4v-6.4h-4z") },
  { value: "search", label: "Search", icon: icon("M10.2 1.6a8.6 8.6 0 1 0 5 15.6l5.3 5.3 2-2-5.3-5.3a8.6 8.6 0 0 0-7-13.6zm0 2.7a5.9 5.9 0 1 1 0 11.8 5.9 5.9 0 0 1 0-11.8z") },
  { value: "settings", label: "Settings", icon: icon("M13.8 1.4h-3.6l-.6 2.9-2 .8-2.5-1.6-2.5 2.5 1.6 2.5-.8 2-2.9.6v3.6l2.9.6.8 2 -1.6 2.5 2.5 2.5 2.5-1.6 2 .8.6 2.9h3.6l.6-2.9 2-.8 2.5 1.6 2.5-2.5-1.6-2.5.8-2 2.9-.6v-3.6l-2.9-.6-.8-2 1.6-2.5-2.5-2.5-2.5 1.6-2-.8zM12 8.6a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z") },
];

function Controls() {
  const stack = { position: "absolute", left: 0, right: 0, top: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 34 } as const;
  return (
    <div style={stack}>
      <SegmentedControl aria-label="Kind" style={{ width: 300 }} items={[{ value: "b", label: "Boxes" }, { value: "p", label: "Pallets" }, { value: "s", label: "Skids" }]} />
      <Stepper aria-label="Count" />
      <Progress value={0.5} style={{ width: 300 }} />
      <Spinner />
      <div style={{ height: 34 }} />
      <Button size="small">Small</Button>
      <Button size="small">Mini</Button>
      <Button size="large">XLarge</Button>
      <Button icon={line("M12 5v14M5 12h14")} aria-label="Add" />
      <Button size="large" icon={line("M12 5v14M5 12h14")} aria-label="Add" />
    </div>
  );
}

function Shown({ kind }: { kind: "sheet" | "alert" }) {
  const [open, setOpen] = useState(get("scene", "").startsWith("show-") ? false : true);
  return (
    <div style={{ position: "absolute", inset: 0 }} onClick={() => setOpen(true)}>
      {kind === "alert" ? (
        <Alert open={open} onOpenChange={setOpen} title="Delete shipment?" message="This can't be undone." actions={[{ label: "Cancel", role: "cancel" }, { label: "Delete", role: "destructive" }]} />
      ) : (
        <Sheet aria-label="Sheet" open={open} onOpenChange={setOpen}>
          <div style={{ height: "100%", marginTop: -30, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: "22px" }}><b style={{ fontWeight: 600 }}>Sheet title</b><span>Body</span></div>
        </Sheet>
      )}
    </div>
  );
}

const line = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d={d} /></svg>;
const menu = (
  <div style={{ position: "absolute", left: 0, right: 0, top: 240, display: "flex", justifyContent: "center" }}>
    <Menu
      aria-label="Create shipment"
      label="Create shipment"
      icon={line("M12 5v14M5 12h14")}
      trigger={{ size: "large" }}
      items={[
        { icon: line("M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"), label: "Parcel", onSelect: () => {} },
        { icon: line("M3 7h11v9H3zM14 10h4l3 3v3h-7"), label: "Freight", onSelect: () => {} },
        "separator",
        { icon: line("M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"), label: "Delete", destructive: true, onSelect: () => {} },
      ]}
    />
  </div>
);

function NavigationScene() {
  const icon2 = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Toolbar aria-label="Nav" style={{ position: "absolute", left: 0, right: 0, top: 54 }}>
        <ToolbarGroup aria-label="Back"><Button aria-label="Back" icon={icon2("M15 5l-7 7 7 7")} /></ToolbarGroup>
        <ToolbarGroup aria-label="Actions"><Button aria-label="Share" icon={icon2("M12 15V4M8 8l4-4 4 4M6 12v8h12v-8")} /><Button aria-label="Edit" icon={icon2("M4 20l1-4L16 5l3 3L8 19z")} /></ToolbarGroup>
      </Toolbar>
      <div style={{ position: "absolute", left: 16, top: 112, fontSize: 34, fontWeight: 700, color: "var(--lg-foreground)" }}>Shipments</div>
      <div style={{ position: "absolute", left: 16, right: 16, top: 170 }}><SearchField /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 797, display: "flex", justifyContent: "center" }}><Button size="large" aria-label="Add" icon={icon2("M12 5v14M5 12h14")} /></div>
    </div>
  );
}

function Merged() {
  const gap = Number(get("gap", "30"));
  const circle = { width: 60, height: 60, borderRadius: 30, display: "grid", placeItems: "center", color: "var(--lg-foreground)", fontSize: 22 };
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 270, display: "flex", justifyContent: "center" }}>
      <GlassGroup style={{ gap }}>
        <Glass style={circle}>+</Glass>
        <Glass style={circle}>✎</Glass>
      </GlassGroup>
    </div>
  );
}

function Probe() {
  const tests = ["corner-shape: squircle", "corner-shape: superellipse(1.6)", "mix-blend-mode: plus-darker", "mix-blend-mode: multiply", "mask-image: url(a.svg)", "color: color-mix(in srgb, red, blue)", "backdrop-filter: blur(1px)", "shape(from 0 0, line to 1px 1px)".replace(/^/, "clip-path: ")];
  const big = { width: 300, height: 90, borderRadius: 34, display: "grid", placeItems: "center", color: "#000", fontSize: 17 } as const;
  return (
    <div style={{ position: "absolute", left: 10, right: 10, top: 70, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      <div style={{ background: "#fff", color: "#000", font: "13px monospace", padding: 6, width: 370 }}>{tests.map((t) => <div key={t}>{CSS.supports(t) ? "YES " : "no  "}{t}</div>)}<div>{navigator.userAgent.slice(0, 90)}</div></div>
      <div style={{ width: 300, height: 90, background: "#fff", borderRadius: 34, cornerShape: "squircle" } as never} />
      <Glass style={big}><span style={{ color: "rgb(90 90 90)" }}>plain text</span></Glass>
      <Glass style={big}><span style={{ color: "rgb(120 120 120)", mixBlendMode: "multiply" }}>multiply text</span></Glass>
      <Glass style={big}><span style={{ color: "rgb(120 120 120)", mixBlendMode: "plus-darker" } as never}>plus-darker text</span></Glass>
      <Glass style={big}><span style={{ color: "rgb(70 70 70)", mixBlendMode: "color-burn" }}>color-burn text</span></Glass>
    </div>
  );
}

function App() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: hex ? `#${bg}` : "#000" }}>
      {edge > 0 && <div data-liquidglass-backdrop={q.get("mark") ? "" : undefined} style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, #000 ${edge}px, #fff ${edge}px)` }} />}
      {!hex && <img data-liquidglass-backdrop={q.get("mark") ? "" : undefined} src={`${bg}.png`} alt="" style={{ position: "absolute", left: 0, top: 0, width: 402, height: 874, imageRendering: "pixelated" }} />}
      {get("scene", "panel") === "probe" ? <Probe /> : get("scene", "panel") === "navigation" ? <NavigationScene /> : get("scene", "panel") === "merge" ? <Merged /> : get("scene", "panel").endsWith("sheet") ? <Shown kind="sheet" /> : get("scene", "panel").endsWith("alert") ? <Shown kind="alert" /> : get("scene", "panel") === "controls" ? <Controls /> : get("scene", "panel") === "menu" ? menu : get("scene", "panel") === "tabs" ? <div style={{ position: "absolute", left: 63.5, top: 791 }}><TabBar aria-label="Tabs" defaultValue="home" items={tabs} /></div> : get("scene", "panel") === "all" ? <All /> : <div style={{ position: "absolute", left: num("x", 201), top: num("y", 300), transform: "translate(-50%, -50%)" }}><Element /></div>}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
