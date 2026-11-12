import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Button, Glass, GlassGroup, Menu, SegmentedControl, Slider, TabBar, Toolbar, ToolbarGroup } from "../dist/index.js";
import video from "../assets/liquidglass-v0.10-parity.mp4";
import { version } from "../package.json";
import { Gallery } from "./gallery";
import { Phone } from "./phone";
import { browserName, icons, refit, refracts, stroke, useCopied, useThrow } from "./shared";

const INSTALL = "npm install @onlymoein/liquidglass";
const REPO = "https://github.com/onlymoein/liquidglass";
const NPM = "https://www.npmjs.com/package/@onlymoein/liquidglass";

const contrast = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 3.500a8.500 8.500 0 0 1 0 17z" fill="currentColor" />
  </svg>
);

type Theme = "system" | "light" | "dark";
type Wall = "flow" | "dusk" | "dawn" | "lines";

const WALLS: { value: Wall; label: string }[] = [
  { value: "flow", label: "Flow" },
  { value: "dusk", label: "Dusk" },
  { value: "dawn", label: "Dawn" },
  { value: "lines", label: "Lines" },
];
const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** A piece of glass that can be dragged and thrown round its parent. */
function Lens({ style, size, label, kick, onMove, start, children }: {
  style?: CSSProperties;
  size: "hero" | "lab";
  label: string;
  kick?: { x: number; y: number };
  onMove?: () => void;
  start: Parameters<typeof useThrow>[1]["start"];
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useThrow(ref, { start, kick, onMove });
  return (
    <div ref={ref} className="drag" data-size={size} role="group" tabIndex={0} aria-label={label}>
      <Glass className="lens" style={style}>{children}</Glass>
    </div>
  );
}

// Where the browser can bend the backdrop, the hero's lens is clear and magnifies,
// so it visibly does. Elsewhere it stays regular glass, which frosts what's behind it.
const HERO_LENS = { "--lg-transparency": 1, "--lg-blur": "1px", "--lg-zoom": 1.22, "--lg-bezel": 30, "--lg-thickness": 44 } as CSSProperties;

function Hero() {
  const [touched, setTouched] = useState(false);
  const [copied, copy] = useCopied();
  return (
    <section className="hero">
      <div className="wall" aria-hidden />
      <h1>liquidglass</h1>
      <Lens
        size="hero"
        label="Glass you can move. Drag it, or use the arrow keys."
        style={refracts() ? HERO_LENS : undefined}
        kick={{ x: -900, y: 60 }}
        onMove={() => setTouched(true)}
        start={(room, own) => ({ x: room.width * 0.86 - own.width / 2, y: room.height * (refracts() ? 0.42 : 0.26) - own.height / 2 })}
      >
        <span className="lens-hint" data-gone={touched || undefined}>Drag me</span>
      </Lens>
      <div className="hero-foot">
        <p>iOS 27 Liquid Glass for React. Glass that bends the light behind it, with controls that move like the real ones.</p>
        <div className="line">
          <Button size="large" className="mono" icon={stroke(icons.copy)} onClick={() => copy(INSTALL)}>{copied ? "Copied" : INSTALL}</Button>
        </div>
      </div>
    </section>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="section" data-spy>
      <header>
        <h2>{title}</h2>
        <p>{intro}</p>
      </header>
      {children}
    </section>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label"><span>{label}</span>{value ? <output>{value}</output> : null}</div>
      {children}
    </div>
  );
}

function Lab({ theme, setTheme, wall, setWall, clear, setClear }: {
  theme: Theme; setTheme: (theme: Theme) => void; wall: Wall; setWall: (wall: Wall) => void; clear: number; setClear: (clear: number) => void;
}) {
  const [bend, setBend] = useState(30);
  const [rim, setRim] = useState(12);
  const [zoom, setZoom] = useState(1);
  const [shine, setShine] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const [copied, copy] = useCopied();
  const bends = refracts();

  useEffect(() => refit(stage.current!), [bend, rim, zoom, shine]);

  const vars = { "--lg-thickness": bend, "--lg-bezel": rim, "--lg-zoom": zoom, "--lg-shine": shine } as CSSProperties;
  const css = `.my-glass {
  --lg-transparency: ${clear.toFixed(2)};
  --lg-thickness: ${bend};
  --lg-bezel: ${rim};
  --lg-zoom: ${zoom.toFixed(2)};
  --lg-shine: ${shine.toFixed(2)};
}`;

  return (
    <div className="lab">
      <div className="stage lab-stage" ref={stage}>
        <div className="specimen" aria-hidden>
          <span>Aa</span><span>Bend</span><span>123</span>
        </div>
        <Lens size="lab" label="Glass you can move. Drag it, or use the arrow keys." style={vars} start={(room, own) => ({ x: (room.width - own.width) / 2 + room.width * 0.14, y: (room.height - own.height) / 2 })} />
      </div>
      <div className="lab-controls" data-theme={wall === "dawn" ? "light" : "dark"}>
        <h3>The whole page</h3>
        <Field label="Transparency" value={clear < 0.5 ? "Tinted" : clear > 0.5 ? "Clear" : "Regular"}>
          <Slider aria-label="Transparency" value={clear * 100} min={0} max={100} onValueChange={(value) => setClear(value / 100)} />
        </Field>
        <Field label="Wallpaper">
          <SegmentedControl aria-label="Wallpaper" value={wall} onValueChange={(value) => setWall(value as Wall)} items={WALLS} />
        </Field>
        <Field label="Appearance">
          <SegmentedControl aria-label="Appearance" value={theme} onValueChange={(value) => setTheme(value as Theme)} items={THEMES} />
        </Field>
        <h3>This lens</h3>
        <Field label="Bend" value={String(bend)}>
          <Slider aria-label="Bend" value={bend} min={0} max={70} disabled={!bends} onValueChange={(value) => setBend(Math.round(value))} />
        </Field>
        <Field label="Rim width" value={String(rim)}>
          <Slider aria-label="Rim width" value={rim} min={3} max={60} disabled={!bends} onValueChange={(value) => setRim(Math.round(value))} />
        </Field>
        <Field label="Zoom" value={`${zoom.toFixed(2)}×`}>
          <Slider aria-label="Zoom" value={zoom * 100} min={100} max={170} disabled={!bends} onValueChange={(value) => setZoom(value / 100)} />
        </Field>
        <Field label="Shine" value={shine.toFixed(2)}>
          <Slider aria-label="Shine" value={shine * 100} min={0} max={200} onValueChange={(value) => setShine(value / 100)} />
        </Field>
        {bends ? null : <p className="note">{browserName()} can't bend what's behind a page's element, so Bend, Rim width and Zoom need a Chromium browser.</p>}
        <div className="snippet">
          <pre><code>{css}</code></pre>
          <Button size="small" onClick={() => copy(css)}>{copied ? "Copied" : "Copy"}</Button>
        </div>
      </div>
    </div>
  );
}

type Place = [x: number, y: number];

// Side by side, or down a diagonal where the stage is narrow, so they start apart.
function Piece({ className, wide, narrow, label, children }: { className: string; wide: Place; narrow: Place; label: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useThrow(ref, {
    start: (room, own) => {
      const [x, y] = room.width < 620 ? narrow : wide;
      return { x: room.width * x - own.width / 2, y: room.height * y - own.height / 2 };
    },
  });
  return <Glass ref={ref} className={`piece ${className}`} role="group" tabIndex={0} aria-label={label}>{children}</Glass>;
}

function Merge() {
  const [spacing, setSpacing] = useState(36);
  return (
    <div className="merge-wrap">
      <div className="stage merge-stage" style={{ "--x": "70%", "--y": "20%" } as never}>
        <GlassGroup spacing={spacing} className="merge">
          <Piece className="round" wide={[0.2, 0.5]} narrow={[0.26, 0.17]} label="Round piece of glass. Drag it towards the others." />
          <Piece className="pill" wide={[0.5, 0.5]} narrow={[0.54, 0.51]} label="Long piece of glass. Drag it towards the others." />
          <Piece className="round small" wide={[0.8, 0.5]} narrow={[0.78, 0.85]} label="Small piece of glass. Drag it towards the others." />
        </GlassGroup>
      </div>
      <div className="merge-controls">
        <Field label="Reach" value={`${spacing} pt`}>
          <Slider aria-label="Reach" value={spacing} min={0} max={80} onValueChange={(value) => setSpacing(Math.round(value))} />
        </Field>
        <pre><code>{`<GlassGroup spacing={${spacing}}>…</GlassGroup>`}</code></pre>
      </div>
    </div>
  );
}

const SUPPORT: { browser: ReturnType<typeof browserName>; text: string }[] = [
  { browser: "Chromium", text: "Glass colour is within 2 levels out of 255 of iOS, in both themes and at both sizes, and its edge bends." },
  { browser: "Safari", text: "Light mode is within 2 levels. Dark mode is approximate, and the edge doesn't bend." },
  { browser: "Firefox", text: "The same colour, blur and rim as Safari. It can bend a copy of a wallpaper you mark, not the live page." },
];

// The recording is well down the page, so it's fetched and played only once it's nearly in view,
// and paused when it's scrolled away, rather than downloading with the page and playing unseen.
function useInView<T extends HTMLMediaElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const media = ref.current;
    if (!media || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void media.play().catch(() => undefined);
        else media.pause();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(media);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Compare() {
  const here = browserName();
  const recording = useInView<HTMLVideoElement>();
  return (
    <div className="compare">
      <figure>
        <video ref={recording} src={video} muted loop playsInline controls preload="none" aria-label="Side-by-side recording of native iOS 27 controls and liquidglass" />
        <figcaption>Left is native iOS 27. Right is liquidglass, recorded on 0.10.</figcaption>
      </figure>
      <div className="support">
        <p>The repo runs real iOS controls and this library on the same simulator, over the same backgrounds and through the same taps, and measures the difference. Button press and menu opening are fitted to recordings of the real thing.</p>
        <ul>
          {SUPPORT.map(({ browser, text }) => (
            <li key={browser} data-here={browser === here || undefined}>
              <strong>{browser}{browser === here ? <em>You're here</em> : null}</strong>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Start() {
  const [copied, copy] = useCopied();
  return (
    <section className="section start">
      <header>
        <h2>Use it.</h2>
        <p>React 18 or later. The styles come with the components.</p>
      </header>
      <div className="snippet big">
        <pre><code>{`${INSTALL}

import { Button, Switch } from "@onlymoein/liquidglass";

<Switch aria-label="Wi-Fi" defaultChecked />
<Button variant="filled">Continue</Button>`}</code></pre>
        <Button size="small" onClick={() => copy(INSTALL)}>{copied ? "Copied" : "Copy"}</Button>
      </div>
      <footer>
        <p>
          <a href={REPO}>GitHub</a> · <a href={NPM}>npm</a> · version {version}
        </p>
        <p>MIT. Copyright Kelvin Zhang and Moein Saharkhiz. Started as a fork of <a href="https://github.com/0kzh/glisse">glisse</a>. Not affiliated with Apple.</p>
      </footer>
    </section>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>("system");
  const [wall, setWall] = useState<Wall>("lines");
  const [clear, setClear] = useState(0.5);
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.dataset.wall = wall;
  }, [theme, wall]);

  useEffect(() => {
    document.documentElement.style.setProperty("--lg-transparency", String(clear));
    const timer = setTimeout(() => refit(), 60);
    return () => clearTimeout(timer);
  }, [clear]);

  // The tab for whichever section crosses the middle of the window. None on the hero,
  // and the footer keeps the last one.
  useEffect(() => {
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setSection((entry.target as HTMLElement).id || null);
      }
    }, { rootMargin: "-50% 0px -50% 0px" });
    for (const element of document.querySelectorAll(".hero, [data-spy]")) seen.observe(element);
    return () => seen.disconnect();
  }, []);

  const pick = (label: string, active: boolean, onSelect: () => void) => ({ label, checked: active, keepOpen: true, onSelect });

  return (
    <>
      <Toolbar aria-label="Site" className="site-bar">
        <ToolbarGroup aria-label="Home">
          <Button onClick={() => scrollTo({ top: 0 })}>liquidglass</Button>
        </ToolbarGroup>
        <div className="bar-end">
          <ToolbarGroup aria-label="Links">
            <Button onClick={() => { location.href = REPO; }}>GitHub</Button>
            <Button onClick={() => { location.href = NPM; }}>npm</Button>
          </ToolbarGroup>
          <Menu
            aria-label="Look"
            icon={contrast}
            align="end"
            items={[
              { heading: "Appearance" },
              ...THEMES.map(({ value, label }) => pick(label, theme === value, () => setTheme(value))),
              "separator",
              { heading: "Wallpaper" },
              ...WALLS.map(({ value, label }) => pick(label, wall === value, () => setWall(value))),
            ]}
          />
        </div>
      </Toolbar>

      <main>
        <Hero />
        <Section id="lab" title="Bend it yourself." intro="Drag the lens over the letters and move the sliders. Each one sets a CSS variable, so you can copy what you end up with.">
          <Lab theme={theme} setTheme={setTheme} wall={wall} setWall={setWall} clear={clear} setClear={setClear} />
        </Section>
        <Section id="controls" title="Every control, live." intro="None of this is a video. Press, hold and drag them, and open the code for any of them.">
          <h3 className="sub">GlassGroup</h3>
          <p className="sub-text">Throw the pieces together. Closer than their reach, they become one shape, and part again as they move away.</p>
          <Merge />
          <Gallery />
        </Section>
        <Section id="app" title="On a screen." intro="A small app made of nothing but these components. Scroll so the colours pass under the bars, and the tab bar shrinks to its current tab.">
          <div className="app-wrap">
            <Phone />
            <ul className="try">
              <li><strong>Scroll</strong> and the large title slides under the bar as its small twin fades in, with a frosted band behind.</li>
              <li><strong>Drag along the tab bar</strong> and the lens follows your finger.</li>
              <li><strong>Tap a swatch</strong> for a sheet, then save it.</li>
              <li><strong>Sort</strong> from the menu at the top left, or open the saved count for a screen with a back button.</li>
              <li><strong>Clear saved</strong> in Settings asks with an alert.</li>
            </ul>
          </div>
        </Section>
        <Section id="compare" title="Next to the real thing." intro="Its look and motion are measured against real iOS 27 on the simulator.">
          <Compare />
        </Section>
        <Start />
      </main>

      <nav className="dock" aria-label="Sections" data-over-app={section === "app" || undefined}>
        <TabBar
          aria-label="Sections"
          value={section}
          onValueChange={setSection}
          items={[
            { value: "lab", label: "Lab", icon: stroke(icons.sliders, 2), href: "#lab" },
            { value: "controls", label: "Controls", icon: stroke(icons.grid, 2), href: "#controls" },
            { value: "app", label: "App", icon: stroke(icons.phone, 2), href: "#app" },
            { value: "compare", label: "Compare", icon: stroke(icons.columns, 2), href: "#compare" },
          ]}
        />
      </nav>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
