import { useRef, useState } from "react";
import { Alert, Button, Menu, NavigationBar, SearchField, SegmentedControl, Sheet, Slider, Stepper, Switch, TabBar, TabBarAccessory, ToolbarGroup } from "../dist/index.js";
import { icons, stroke } from "./shared";

interface Swatch {
  name: string;
  from: string;
  to: string;
  warm: boolean;
}

const SWATCHES: Swatch[] = [
  { name: "Ember", from: "#ff5a36", to: "#b3122e", warm: true },
  { name: "Lagoon", from: "#19c3c9", to: "#0a4fb5", warm: false },
  { name: "Plum", from: "#a03bd6", to: "#3b1178", warm: false },
  { name: "Saffron", from: "#ffd23f", to: "#f0761f", warm: true },
  { name: "Kelp", from: "#57c84d", to: "#0d5c49", warm: false },
  { name: "Rosewater", from: "#ffb3c7", to: "#e0338f", warm: true },
  { name: "Ink", from: "#3a4a9c", to: "#0a0f2e", warm: false },
  { name: "Clay", from: "#d98a5f", to: "#6e2f1c", warm: true },
  { name: "Glacier", from: "#c9f0ff", to: "#3f94e0", warm: false },
  { name: "Marigold", from: "#ffae2b", to: "#e23d28", warm: true },
  { name: "Moss", from: "#b7c94a", to: "#3e5a1e", warm: false },
  { name: "Orchid", from: "#f07be0", to: "#6a2cf0", warm: true },
  { name: "Harbour", from: "#2f7fa8", to: "#0c2a44", warm: false },
  { name: "Coral", from: "#ff8c7a", to: "#d4265c", warm: true },
];

type Sort = "Warm first" | "Cool first" | "A to Z";

function order(sort: Sort): Swatch[] {
  const all = [...SWATCHES];
  if (sort === "A to Z") return all.sort((a, b) => a.name.localeCompare(b.name));
  return all.sort((a, b) => Number(b.warm === (sort === "Warm first")) - Number(a.warm === (sort === "Warm first")));
}

function Cards({ swatches, onOpen }: { swatches: Swatch[]; onOpen: (swatch: Swatch) => void }) {
  return (
    <div className="cards">
      {swatches.map((swatch) => (
        <button key={swatch.name} className="card" style={{ backgroundImage: `linear-gradient(145deg, ${swatch.from}, ${swatch.to})` }} onClick={() => onOpen(swatch)}>
          {swatch.name}
        </button>
      ))}
    </div>
  );
}

/** A small app on a phone-sized screen, built from nothing but the library. */
export function Phone() {
  const [tab, setTab] = useState("swatches");
  const [small, setSmall] = useState(false);
  const [sort, setSort] = useState<Sort>("Warm first");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Swatch | null>(null);
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [size, setSize] = useState(2);
  const [weight, setWeight] = useState(60);
  const scroller = useRef<HTMLDivElement>(null);
  const lastTop = useRef(0);

  const scrolled = (top: number) => {
    if (top > lastTop.current + 6 && top > 60) setSmall(true);
    else if (top < lastTop.current - 6) setSmall(false);
    lastTop.current = top;
  };
  const top = () => {
    setSmall(false);
    scroller.current?.scrollTo({ top: 0 });
    lastTop.current = 0;
  };
  const go = (next: string) => {
    setTab(next);
    setPushed(false);
    top();
  };
  const push = (next: boolean) => {
    setPushed(next);
    top();
  };
  const show = (swatch: Swatch) => {
    setPicked(swatch);
    setOpen(true);
  };
  const sortItem = (label: Sort) => ({ label, checked: sort === label, keepOpen: true, onSelect: () => setSort(label) });
  const saved = picked ? palette.includes(picked.name) : false;
  const recent = picked ?? SWATCHES[0]!;
  const recentSaved = palette.includes(recent.name);

  return (
    <div className="phone">
      <div className="phone-scroll" ref={scroller} onScroll={(event) => scrolled(event.currentTarget.scrollTop)}>
        {pushed ? (
          <>
            <NavigationBar key="saved" level={3} title="Saved" onBack={() => push(false)} />
            <div className="phone-page">
                {palette.length ? <Cards swatches={SWATCHES.filter((swatch) => palette.includes(swatch.name))} onOpen={show} /> : <p className="phone-empty">Nothing saved yet. Open a swatch and tap Save.</p>}
            </div>
          </>
        ) : (
          tab === "swatches" && (
            <>
              <NavigationBar
                key="swatches"
                level={3}
                title="Swatches"
                leading={<Menu aria-label="Sort" icon={stroke(icons.sort)} align="start" items={[{ heading: "Sort" }, sortItem("Warm first"), sortItem("Cool first"), sortItem("A to Z")]} />}
                trailing={
                  <ToolbarGroup aria-label="Saved">
                    <Button aria-label={`${palette.length} saved`} icon={stroke(icons.swatch)} onClick={() => push(true)}>{palette.length}</Button>
                  </ToolbarGroup>
                }
              />
              <div className="phone-page">
                <Cards swatches={order(sort)} onOpen={show} />
              </div>
            </>
          )
        )}
        {!pushed && tab === "search" && (
          <>
            <NavigationBar key="search" level={3} title="Search" />
            <div className="phone-page">
              <SearchField aria-label="Search swatches" placeholder="Try “plum”" value={query} onValueChange={setQuery} />
              <Cards swatches={SWATCHES.filter((swatch) => swatch.name.toLowerCase().includes(query.trim().toLowerCase()))} onOpen={show} />
            </div>
          </>
        )}
        {!pushed && tab === "settings" && (
          <>
            <NavigationBar key="settings" level={3} title="Settings" />
            <div className="phone-page">
              <div className="group">
                <label className="row">Show names <Switch aria-label="Show names" defaultChecked /></label>
                <label className="row">Sync <Switch aria-label="Sync" /></label>
                <div className="row">Columns <Stepper aria-label="Columns" value={size} min={1} max={4} onValueChange={setSize} /></div>
              </div>
              <div className="group">
                <div className="row column">Finish <SegmentedControl aria-label="Finish" className="wide" defaultValue="matte" items={[{ value: "matte", label: "Matte" }, { value: "satin", label: "Satin" }, { value: "gloss", label: "Gloss" }]} /></div>
                <div className="row column">Saturation <Slider aria-label="Saturation" value={weight} min={0} max={100} onValueChange={setWeight} /></div>
              </div>
              <div className="group">
                <div className="row column">Saved: {palette.length ? palette.join(", ") : "nothing yet"}</div>
              </div>
              <Button destructive size="large" className="wide" disabled={!palette.length} onClick={() => setAsking(true)}>Clear saved</Button>
            </div>
          </>
        )}
      </div>

      <div className="phone-tabs">
        <div className="phone-dock" data-small={small ? "" : undefined}>
          <TabBarAccessory aria-label="Last opened swatch" placement={small ? "inline" : "above"}>
            <button type="button" className="accessory-open" aria-label={`Open ${recent.name}`} onClick={() => show(recent)}>
              <span className="accessory-art" style={{ backgroundImage: `linear-gradient(145deg, ${recent.from}, ${recent.to})` }} />
              <span className="accessory-title">
                {recent.name}
                {!small && <span className="accessory-sub">{picked ? "Last opened" : "Try this one"}</span>}
              </span>
            </button>
            <Button
              aria-label={recentSaved ? `Remove ${recent.name}` : `Save ${recent.name}`}
              size="small"
              icon={stroke(recentSaved ? icons.check : icons.plus, 2)}
              onClick={() => setPalette((all) => (recentSaved ? all.filter((name) => name !== recent.name) : [...all, recent.name]))}
            />
          </TabBarAccessory>
          <TabBar
            aria-label="Sections"
            value={tab}
            onValueChange={go}
            minimized={small}
            onExpand={() => setSmall(false)}
            items={[
              { value: "swatches", label: "Swatches", icon: stroke(icons.swatch, 2) },
              { value: "search", label: "Search", icon: stroke(icons.search, 2) },
              { value: "settings", label: "Settings", icon: stroke(icons.gear, 2) },
            ]}
          />
        </div>
      </div>

      <Sheet aria-label={picked?.name ?? "Swatch"} open={open} onOpenChange={setOpen}>
        <div className="sheet-body">
          <div className="sheet-swatch" style={{ backgroundImage: picked ? `linear-gradient(145deg, ${picked.from}, ${picked.to})` : undefined }} />
          <h3>{picked?.name}</h3>
          <p>{picked?.from} to {picked?.to}</p>
          <Button
            variant="filled"
            size="large"
            onClick={() => {
              if (picked) setPalette((all) => (saved ? all.filter((name) => name !== picked.name) : [...all, picked.name]));
              setOpen(false);
            }}
          >
            {saved ? "Remove" : "Save"}
          </Button>
          <h4>Nearby shades</h4>
          <ul className="shades">
            {SWATCHES.filter((swatch) => picked && swatch.name !== picked.name && swatch.warm === picked.warm).map((swatch) => (
              <li key={swatch.name}>
                <span className="shade-chip" style={{ backgroundImage: `linear-gradient(145deg, ${swatch.from}, ${swatch.to})` }} />
                {swatch.name}
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
      <Alert
        open={asking}
        onOpenChange={setAsking}
        title="Clear saved swatches?"
        message="You'll have to pick them again."
        actions={[{ label: "Cancel", role: "cancel" }, { label: "Clear", role: "destructive", onSelect: () => setPalette([]) }]}
      />
    </div>
  );
}
