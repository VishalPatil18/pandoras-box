import { interpolate, useCurrentFrame } from "remotion";
import { Clip } from "../components/Clip";
import { CodePanel } from "../components/CodePanel";
import { Alternatives, RaceDiagram, TestOutput } from "../components/Diagrams";
import { DisplayText } from "../components/DisplayText";
import { PopIn, Shot, useBeat } from "../components/Shot";
import { SqlPanel } from "../components/SqlPanel";
import { Label, Sticker } from "../components/Sticker";
import { CLAMP, EASE, FONT } from "../theme";

function Rule() {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
      <DisplayText lines={["At most one", "fact a minute"]} size={160} at={4} />
      <div style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 50, opacity: interpolate(frame, [34, 46], [0, 1], CLAMP) }}>
        even when requests race
      </div>
      <PopIn at={26} rotate={-10} style={{ position: "absolute", left: -200, top: 40 }}>
        <Sticker icon="clock" color="sun" size={120} />
      </PopIn>
      <PopIn at={32} rotate={12} style={{ position: "absolute", right: -190, bottom: 90 }}>
        <Sticker icon="refresh-cw" color="blue" size={104} />
      </PopIn>
    </div>
  );
}

function FreshCheck() {
  const ask = useBeat("lea-2");
  const clock = useBeat("lea-3");
  return (
    <CodePanel
      id="facts-fresh"
      focus={[
        { at: ask.from, lines: [39, 49] },
        { at: clock.from, lines: [42, 47] },
      ]}
      notes={[
        { at: ask.from + 30, line: 47, text: "under 60 seconds old", color: "sun" },
        { at: clock.from + 10, line: 42, text: "Postgres clock, not the server's", color: "mint" },
      ]}
    />
  );
}

function Claim() {
  const claim = useBeat("lea-4");
  const rules = useBeat("lea-5");
  return (
    <CodePanel
      id="facts-lease"
      focus={[
        { at: claim.from, lines: [61, 72] },
        { at: rules.from, lines: [66, 69] },
      ]}
      notes={[
        { at: claim.from + 24, line: 65, text: "one conditional UPDATE", color: "lavender" },
        { at: rules.from + 10, line: 66, text: "15 second expiry", color: "sun" },
        { at: rules.from + 40, line: 69, text: "only if no live lease", color: "mint" },
      ]}
    />
  );
}

function Release() {
  const line = useBeat("lea-7");
  const half = (line.to - line.from) / 2;
  return (
    <CodePanel
      id="facts-get"
      focus={[
        { at: line.from, lines: [149, 153] },
        { at: line.from + half, lines: [154, 156] },
      ]}
      notes={[
        { at: line.from + 12, line: 153, text: "winner calls OpenAI", color: "sun" },
        { at: line.from + half + 8, line: 155, text: "released with its own token", color: "mint" },
      ]}
    />
  );
}

function TwoTabs() {
  const frame = useCurrentFrame();
  const tabs = useBeat("lea-9");
  const result = useBeat("lea-10");
  const swap = result.from + Math.round((result.to - result.from) * 0.45);
  const tabsOut = interpolate(frame, [swap, swap + 12], [1, 0], { ...CLAMP, easing: EASE.inOut });
  const sqlIn = interpolate(frame, [swap + 4, swap + 16], [0, 1], { ...CLAMP, easing: EASE.out });
  return (
    <div style={{ position: "relative", width: 1700, height: 760, display: "grid", placeItems: "center" }}>
      <div style={{ display: "flex", gap: 40, opacity: tabsOut, scale: String(0.94 + 0.06 * tabsOut) }}>
        <Clip name="tab-left" from={0.3} width={790} url="localhost:3000/dashboard" length={swap + 12} />
        <Clip name="tab-right" from={0.3} width={790} url="localhost:3000/dashboard" length={swap + 12} />
      </div>
      <div style={{ position: "absolute", top: 6, opacity: tabsOut }}>
        <PopIn at={tabs.from + 4} rotate={-3}>
          <Label color="carbon" size={34}>⌘R in both tabs at once</Label>
        </PopIn>
      </div>
      <div style={{ position: "absolute", bottom: 4, opacity: tabsOut }}>
        <PopIn at={result.from + 2} rotate={3}>
          <Label color="mint" size={36}>same fact in both</Label>
        </PopIn>
      </div>
      <div style={{ position: "absolute", opacity: sqlIn, translate: `0px ${(1 - sqlIn) * 40}px` }}>
        <SqlPanel insertAt={swap + 14} />
      </div>
    </div>
  );
}

function Simpler() {
  const memory = useBeat("lea-12");
  const unique = useBeat("lea-13");
  const advisory = useBeat("lea-14");
  const lease = useBeat("lea-15");
  return <Alternatives reveal={[memory.from, unique.from, advisory.from, lease.from]} />;
}

function LeaseTest() {
  const line = useBeat("lea-16");
  const half = (line.to - line.from) / 2;
  return (
    <CodePanel
      id="test-lease"
      focus={[
        { at: line.from, lines: [47, 47] },
        { at: line.from + half, lines: [49, 49] },
      ]}
      notes={[
        { at: line.from + 10, line: 47, text: "five parallel requests", color: "sun" },
        { at: line.from + half + 8, line: 49, text: "exactly one OpenAI call", color: "mint" },
      ]}
    />
  );
}

export function LeaseScene() {
  return (
    <>
      <Shot name="The rule" from="lea-1" to="lea-1">
        <Rule />
      </Shot>
      <Shot name="Fresh check" from="lea-2" to="lea-3">
        <FreshCheck />
      </Shot>
      <Shot name="Claim" from="lea-4" to="lea-5">
        <Claim />
      </Shot>
      <Shot name="Race" from="lea-6" to="lea-6">
        <RaceDiagram phase="claim" />
      </Shot>
      <Shot name="Release" from="lea-7" to="lea-7">
        <Release />
      </Shot>
      <Shot name="Poll" from="lea-8" to="lea-8">
        <RaceDiagram phase="poll" />
      </Shot>
      <Shot name="Two tabs" from="lea-9" to="lea-10">
        <TwoTabs />
      </Shot>
      <Shot name="Why not simpler" from="lea-11" to="lea-15">
        <Simpler />
      </Shot>
      <Shot name="Lease test" from="lea-16" to="lea-16">
        <LeaseTest />
      </Shot>
      <Shot name="Test output" from="lea-17" to="lea-17">
        <TestOutput at={4} />
      </Shot>
    </>
  );
}

