import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Alert, Button, ContextMenu, Glass, GlassGroup, Menu, Progress, SearchField, SegmentedControl, Sheet, Slider, Spinner, Stepper, Switch, TabBar, Toolbar, ToolbarGroup,
} from "../dist/index.js";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const solid = (d: string) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={d} /></svg>;
const I = {
  plus: "M12 5v14M5 12h14", back: "M15 5l-7 7 7 7", share: "M12 15V4M8 8l4-4 4 4M6 12v8h12v-8", edit: "M4 20l1-4L16 5l3 3L8 19z",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8", truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z", trash: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13", copy: "M9 9h10v11H9zM5 15V4h10",
  home: "M12 3 2 12h3v9h5v-6h4v6h5v-9h3z", search: "M10 3a7 7 0 1 0 4.2 12.6l5.1 5.1 1.4-1.4-5.1-5.1A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z", gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 5.5v-3l-2.4-.5-.7-1.7 1.4-2-2.1-2.1-2 1.4-1.7-.7L13.5 3h-3l-.5 2.4-1.7.7-2-1.4-2.1 2.1 1.4 2-.7 1.7L3 10.5v3l2.4.5.7 1.7-1.4 2 2.1 2.1 2-1.4 1.7.7.5 2.4h3l.5-2.4 1.7-.7 2 1.4 2.1-2.1-1.4-2 .7-1.7z",
};

function Row({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="row">
      <h2>{title}</h2>
      <div className="stage">{children}</div>
      {note ? <p>{note}</p> : null}
    </section>
  );
}

function App() {
  const [on, setOn] = useState(true);
  const [gap, setGap] = useState(24);
  const [sheet, setSheet] = useState(false);
  const [alert, setAlert] = useState(false);
  const [count, setCount] = useState(3);
  const [clear, setClear] = useState(50);
  const [tab, setTab] = useState("home");
  const [small, setSmall] = useState(false);
  return (
    <div className="page" style={{ "--lg-transparency": clear / 100 } as never} onScroll={(e) => setSmall(e.currentTarget.scrollTop > 900)}>
      <div className="wall" aria-hidden />
      <Toolbar aria-label="Page" className="bar">
        <ToolbarGroup aria-label="Back"><Button aria-label="Back" icon={icon(I.back)} /></ToolbarGroup>
        <ToolbarGroup aria-label="Actions"><Button aria-label="Share" icon={icon(I.share)} /><Button aria-label="Edit" icon={icon(I.edit)} /></ToolbarGroup>
      </Toolbar>
      <main>
        <header>
          <h1>liquidglass</h1>
          <p>Every control here is a web page copying iOS 27, measured against the real thing. Scroll so the colours pass under the glass, and hold things down.</p>
        </header>
        <Row title="Buttons" note="Press and hold one, then let go. It swells, then dips past its size as it settles.">
          <Button size="small">Small</Button><Button>Regular</Button><Button size="large">Large</Button>
          <Button variant="filled">Filled</Button><Button variant="filled" size="large">Filled</Button><Button destructive>Delete</Button><Button aria-label="Add" size="large" icon={icon(I.plus)} />
        </Row>
        <Row title="Menu" note="The button itself stretches into the menu.">
          <Menu aria-label="Create shipment" label="Create shipment" icon={icon(I.plus)} trigger={{ size: "large" }} items={[
            { icon: icon(I.box), label: "Parcel" }, { icon: icon(I.truck), label: "Freight" }, "separator", { icon: icon(I.trash), label: "Delete", destructive: true },
          ]} />
        </Row>
        <Row title="Context menu" note="Hold this down, or right-click it.">
          <ContextMenu aria-label="Note" items={[{ icon: icon(I.copy), label: "Copy" }, { icon: icon(I.trash), label: "Delete", destructive: true }]}>
            <Glass className="note">Hold me</Glass>
          </ContextMenu>
        </Row>
        <Row title="Switch and slider" note="Hold the thumbs: they lift as clear glass.">
          <Switch aria-label="Example switch" checked={on} onCheckedChange={setOn} />
          <div className="grow"><Slider aria-label="Example slider" defaultValue={40} min={0} max={100} /></div>
        </Row>
        <Row title="Segmented control and stepper">
          <SegmentedControl aria-label="Kind" className="grow" items={[{ value: "b", label: "Boxes" }, { value: "p", label: "Pallets" }, { value: "s", label: "Skids" }]} />
          <Stepper aria-label="Count" value={count} min={0} max={10} onValueChange={setCount} />
        </Row>
        <Row title="Progress">
          <div className="grow"><Progress aria-label="Example progress" value={count / 10} /></div><Spinner />
        </Row>
        <Row title="Glass that merges" note="Drag the slider and watch the two pieces flow together.">
          <GlassGroup spacing={20} style={{ gap }}>
            <Button size="large" aria-label="Add" icon={icon(I.plus)} />
            <Button size="large" aria-label="Edit" icon={icon(I.edit)} />
          </GlassGroup>
          <div className="grow"><Slider aria-label="Gap between the pieces" value={gap} min={0} max={60} onValueChange={setGap} /></div>
        </Row>
        <Row title="Sheet and alert" note="Drag the sheet by its handle: up to full height, down to dismiss.">
          <Button variant="filled" onClick={() => setSheet(true)}>Open sheet</Button>
          <Button onClick={() => setAlert(true)}>Show alert</Button>
        </Row>
        <Row title="Search"><div className="grow"><SearchField /></div></Row>
        <Row title="Clear to tinted" note="Like the iOS setting. It changes everything on this page; the middle is regular glass.">
          <div className="grow"><Slider aria-label="Glass transparency" value={clear} min={0} max={100} onValueChange={setClear} /></div>
        </Row>
        <footer>Keep scrolling and the tab bar shrinks to its current tab. Tap it to bring it back.</footer>
      </main>
      <div className="tabs">
        <TabBar aria-label="Sections" value={tab} onValueChange={setTab} minimized={small} onExpand={() => setSmall(false)} items={[
          { value: "home", label: "Home", icon: solid(I.home) }, { value: "search", label: "Search", icon: solid(I.search) }, { value: "settings", label: "Settings", icon: solid(I.gear) },
        ]} />
      </div>
      <Sheet aria-label="Example sheet" open={sheet} onOpenChange={setSheet}>
        <div className="sheet"><h2>A real sheet</h2><p>It floats as glass at half height, and turns opaque as it reaches full height.</p><Button variant="filled" size="large" onClick={() => setSheet(false)}>Done</Button></div>
      </Sheet>
      <Alert open={alert} onOpenChange={setAlert} title="Delete shipment?" message="This can't be undone." actions={[{ label: "Cancel", role: "cancel" }, { label: "Delete", role: "destructive" }]} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
