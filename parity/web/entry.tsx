import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Button, Glass, Slider, Switch, TabBar } from "../../dist/index.js";

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
    case "filled": return <Button variant="filled">Continue</Button>;
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

const icon = (d: string) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={d} /></svg>;
const tabs = [
  { value: "home", label: "Home", icon: icon("M12 3 2 12h3v9h5v-6h4v6h5v-9h3z") },
  { value: "search", label: "Search", icon: icon("M10 3a7 7 0 1 0 4.2 12.6l5.1 5.1 1.4-1.4-5.1-5.1A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z") },
  { value: "settings", label: "Settings", icon: icon("M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 5.5v-3l-2.4-.5-.7-1.7 1.4-2-2.1-2.1-2 1.4-1.7-.7L13.5 3h-3l-.5 2.4-1.7.7-2-1.4-2.1 2.1 1.4 2-.7 1.7L3 10.5v3l2.4.5.7 1.7-1.4 2 2.1 2.1 2-1.4 1.7.7.5 2.4h3l.5-2.4 1.7-.7 2 1.4 2.1-2.1-1.4-2 .7-1.7z") },
];

function App() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: hex ? `#${bg}` : "#000" }}>
      {edge > 0 && <div data-liquidglass-backdrop={q.get("mark") ? "" : undefined} style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, #000 ${edge}px, #fff ${edge}px)` }} />}
      {!hex && <img data-liquidglass-backdrop={q.get("mark") ? "" : undefined} src={`${bg}.png`} alt="" style={{ position: "absolute", left: 0, top: 0, width: 402, height: 874, imageRendering: "pixelated" }} />}
      {get("scene", "panel") === "tabs" ? <div style={{ position: "absolute", left: 63.5, top: 790 }}><TabBar aria-label="Tabs" defaultValue="home" items={tabs} /></div> : get("scene", "panel") === "all" ? <All /> : <div style={{ position: "absolute", left: num("x", 201), top: num("y", 300), transform: "translate(-50%, -50%)" }}><Element /></div>}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
