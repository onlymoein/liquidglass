import { useState, type ReactNode } from "react";
import {
  Alert, Button, ContextMenu, Glass, Input, Menu, PageControl, Progress, SearchField, SegmentedControl, Sheet, Slider, Spinner, Stepper, Switch, TabBar, Toolbar, ToolbarGroup,
} from "../dist/index.js";
import { icons, stroke, useCopied } from "./shared";

function Buttons() {
  return (
    <div className="stack">
      <div className="line">
        <Button size="small">Small</Button>
        <Button>Regular</Button>
        <Button size="large">Large</Button>
      </div>
      <div className="line">
        <Button variant="filled">Filled</Button>
        <Button destructive>Delete</Button>
        <Button aria-label="Add" size="large" icon={stroke(icons.plus)} />
      </div>
    </div>
  );
}

function MenuDemo() {
  const [sort, setSort] = useState("Name");
  const choice = (label: string) => ({ label, checked: sort === label, keepOpen: true, onSelect: () => setSort(label) });
  return (
    <Menu
      aria-label="Sort"
      label={`Sort by ${sort.toLowerCase()}`}
      icon={stroke(icons.sort)}
      trigger={{ size: "large" }}
      items={[
        { heading: "Sort by" },
        choice("Name"),
        choice("Date"),
        choice("Size"),
        "separator",
        { icon: stroke(icons.share), label: "Share" },
        { icon: stroke(icons.trash), label: "Delete", destructive: true },
      ]}
    />
  );
}

function Hold() {
  return (
    <ContextMenu aria-label="Note" items={[{ icon: stroke(icons.copy), label: "Copy" }, { icon: stroke(icons.share), label: "Share" }, "separator", { icon: stroke(icons.trash), label: "Delete", destructive: true }]}>
      <Glass className="hold">Hold me</Glass>
    </ContextMenu>
  );
}

function Switches() {
  return (
    <div className="rows">
      <label className="row">Wi-Fi <Switch aria-label="Wi-Fi" defaultChecked /></label>
      <label className="row">Bluetooth <Switch aria-label="Bluetooth" /></label>
    </div>
  );
}

function SliderDemo() {
  const [value, setValue] = useState(40);
  return (
    <div className="wide">
      <Slider aria-label="Volume" value={value} min={0} max={100} onValueChange={setValue} />
      <output className="readout">{Math.round(value)}</output>
    </div>
  );
}

function Segments() {
  return <SegmentedControl aria-label="Kind" className="wide" items={[{ value: "b", label: "Boxes" }, { value: "p", label: "Pallets" }, { value: "s", label: "Skids" }]} defaultValue="b" />;
}

function Steps() {
  const [count, setCount] = useState(3);
  return (
    <div className="stack wide">
      <div className="line between">
        <Stepper aria-label="Count" value={count} min={0} max={10} onValueChange={setCount} />
        <Spinner />
      </div>
      <Progress aria-label="Progress" value={count / 10} />
      <output className="readout">{count} of 10</output>
    </div>
  );
}

function Pages() {
  const [page, setPage] = useState(1);
  return (
    <div className="stack center">
      <PageControl aria-label="Photos" count={5} value={page} onValueChange={setPage} />
      <output className="readout">Page {page + 1} of 5</output>
    </div>
  );
}

function AlertDemo() {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  return (
    <div className="stack center">
      <Button size="large" onClick={() => setOpen(true)}>Show alert</Button>
      <output className="readout">{answer || " "}</output>
      <Alert
        open={open}
        onOpenChange={setOpen}
        title="Delete shipment?"
        message="This can't be undone."
        actions={[
          { label: "Cancel", role: "cancel", onSelect: () => setAnswer("Kept it") },
          { label: "Delete", role: "destructive", onSelect: () => setAnswer("Deleted") },
        ]}
      />
    </div>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="filled" size="large" onClick={() => setOpen(true)}>Open sheet</Button>
      <Sheet aria-label="Example sheet" open={open} onOpenChange={setOpen}>
        <div className="sheet-body">
          <h3>A real sheet</h3>
          <p>It floats as glass at half height and turns opaque at full height. Drag the handle up, or down to dismiss it.</p>
          <Button variant="filled" size="large" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Sheet>
    </>
  );
}

function Fields() {
  return (
    <div className="stack wide">
      <SearchField aria-label="Search" placeholder="Search" />
      <Input aria-label="Name" placeholder="Name" />
    </div>
  );
}

function Tabs() {
  const [small, setSmall] = useState(false);
  return (
    <div className="stack center wide">
      <div className="tabs-demo">
        <TabBar
          aria-label="Example tabs"
          defaultValue="swatches"
          minimized={small}
          onExpand={() => setSmall(false)}
          items={[
            { value: "swatches", label: "Swatches", icon: stroke(icons.swatch, 2) },
            { value: "search", label: "Search", icon: stroke(icons.search, 2) },
            { value: "settings", label: "Settings", icon: stroke(icons.gear, 2) },
          ]}
        />
      </div>
      <label className="row small">Minimized <Switch aria-label="Minimized" checked={small} onCheckedChange={setSmall} /></label>
    </div>
  );
}

function Bar() {
  const [edge, setEdge] = useState("uniform");
  return (
    <div className="scroll-demo" tabIndex={0} role="region" aria-label="Scroll under the toolbar">
      <Toolbar aria-label="Example" edge={edge as "uniform" | "soft" | "none"}>
        <ToolbarGroup aria-label="Actions">
          <Button aria-label="Add" icon={stroke(icons.plus)} />
          <Button aria-label="Share" icon={stroke(icons.share)} />
        </ToolbarGroup>
        <SegmentedControl aria-label="Edge" value={edge} onValueChange={setEdge} items={[{ value: "uniform", label: "Uniform" }, { value: "soft", label: "Soft" }, { value: "none", label: "None" }]} />
      </Toolbar>
      <div className="scroll-fill">
        {["Scroll", "under", "the", "toolbar"].map((word) => <p key={word}>{word}</p>)}
      </div>
    </div>
  );
}

interface Tile {
  title: string;
  how: string;
  demo: ReactNode;
  code: string;
  wide?: boolean;
  bare?: boolean;
}

const TILES: Tile[] = [
  {
    title: "Button",
    how: "Press and hold, then let go. It swells, then dips past its size as it settles.",
    demo: <Buttons />,
    code: `<Button size="large">Large</Button>
<Button variant="filled">Filled</Button>
<Button destructive>Delete</Button>
<Button aria-label="Add" icon={<PlusIcon />} />`,
  },
  {
    title: "Menu",
    how: "The pill itself stretches into the menu. Try the choices: it stays open.",
    demo: <MenuDemo />,
    code: `<Menu
  aria-label="Sort"
  label="Sort by name"
  items={[
    { heading: "Sort by" },
    { label: "Name", checked: sort === "name", keepOpen: true, onSelect: () => setSort("name") },
    { label: "Date", checked: sort === "date", keepOpen: true, onSelect: () => setSort("date") },
    "separator",
    { label: "Delete", destructive: true, onSelect: remove },
  ]}
/>`,
  },
  {
    title: "ContextMenu",
    how: "Hold it down, or right-click it.",
    demo: <Hold />,
    code: `<ContextMenu
  aria-label="Note"
  items={[
    { label: "Copy", onSelect: copy },
    { label: "Delete", destructive: true, onSelect: remove },
  ]}
>
  <Glass>Hold me</Glass>
</ContextMenu>`,
  },
  {
    title: "Switch",
    how: "Tap it, or hold the thumb: it lifts as clear glass.",
    demo: <Switches />,
    code: `<Switch aria-label="Wi-Fi" defaultChecked />
<Switch aria-label="Bluetooth" checked={on} onCheckedChange={setOn} />`,
  },
  {
    title: "Slider",
    how: "Hold the thumb and drag. It turns into a lens over the track.",
    demo: <SliderDemo />,
    code: `<Slider aria-label="Volume" value={value} min={0} max={100} onValueChange={setValue} />`,
  },
  {
    title: "SegmentedControl",
    how: "Tap a choice, or hold the thumb and drag: it lifts as clear glass.",
    demo: <Segments />,
    code: `<SegmentedControl
  aria-label="Kind"
  defaultValue="boxes"
  items={[
    { value: "boxes", label: "Boxes" },
    { value: "pallets", label: "Pallets" },
    { value: "skids", label: "Skids" },
  ]}
/>`,
  },
  {
    title: "Stepper, Progress, Spinner",
    how: "The stepper drives the bar.",
    demo: <Steps />,
    code: `<Stepper aria-label="Count" value={count} min={0} max={10} onValueChange={setCount} />
<Progress aria-label="Progress" value={count / 10} />
<Spinner />`,
  },
  {
    title: "PageControl",
    how: "Dots on a capsule of glass; click one or use the arrow keys.",
    demo: <Pages />,
    code: `<PageControl aria-label="Photos" count={5} value={page} onValueChange={setPage} />`,
  },
  {
    title: "Alert",
    how: "A modal question with pill buttons.",
    demo: <AlertDemo />,
    code: `<Alert
  open={open}
  onOpenChange={setOpen}
  title="Delete shipment?"
  message="This can't be undone."
  actions={[
    { label: "Cancel", role: "cancel" },
    { label: "Delete", role: "destructive", onSelect: remove },
  ]}
/>`,
  },
  {
    title: "Sheet",
    how: "Drag its handle between half and full height, or down to dismiss.",
    demo: <SheetDemo />,
    code: `<Sheet aria-label="Details" open={open} onOpenChange={setOpen}>
  {details}
</Sheet>`,
  },
  {
    title: "SearchField, Input",
    how: "Text fields set in glass.",
    demo: <Fields />,
    code: `<SearchField aria-label="Search" placeholder="Search" />
<Input aria-label="Name" placeholder="Name" />`,
  },
  {
    title: "TabBar",
    how: "Drag across the tabs and the lens follows your finger.",
    demo: <Tabs />,
    wide: true,
    code: `<TabBar
  aria-label="Sections"
  value={tab}
  onValueChange={setTab}
  minimized={scrolledDown}
  onExpand={() => setScrolledDown(false)}
  items={[
    { value: "swatches", label: "Swatches", icon: <SwatchIcon /> },
    { value: "search", label: "Search", icon: <SearchIcon /> },
    { value: "settings", label: "Settings", icon: <GearIcon /> },
  ]}
/>`,
  },
  {
    title: "Toolbar",
    how: "Scroll this panel, and compare the three edges. Arrow keys move between the actions.",
    demo: <Bar />,
    wide: true,
    bare: true,
    code: `<Toolbar aria-label="Notes" edge="uniform">
  <ToolbarGroup aria-label="Actions">
    <Button>Share</Button>
    <Button>Edit</Button>
  </ToolbarGroup>
</Toolbar>`,
  },
];

export function Gallery() {
  const [shown, setShown] = useState<Tile | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, copy] = useCopied();
  return (
    <div className="gallery">
      {TILES.map((tile, index) => (
        <article key={tile.title} className="tile" data-wide={tile.wide || undefined}>
          <div className="stage" data-bare={tile.bare || undefined} style={{ "--x": `${(index * 37) % 100}%`, "--y": `${(index * 61) % 100}%` } as never}>
            {tile.demo}
          </div>
          <div className="tile-text">
            <div>
              <h3>{tile.title}</h3>
              <p>{tile.how}</p>
            </div>
            <Button size="small" onClick={() => { setShown(tile); setOpen(true); }} aria-label={`Code for ${tile.title}`}>Code</Button>
          </div>
        </article>
      ))}
      <Sheet aria-label={shown ? `Code for ${shown.title}` : "Code"} open={open} onOpenChange={setOpen}>
        <div className="sheet-body code-sheet">
          <div className="code-head">
            <h3>{shown?.title}</h3>
            <Button size="small" onClick={() => copy(shown?.code ?? "")}>{copied ? "Copied" : "Copy"}</Button>
          </div>
          <pre><code>{shown?.code}</code></pre>
        </div>
      </Sheet>
    </div>
  );
}
