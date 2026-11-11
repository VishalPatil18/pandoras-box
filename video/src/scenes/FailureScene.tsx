import { Clip } from "../components/Clip";
import { CodePanel } from "../components/CodePanel";
import { RetryButton } from "../components/Diagrams";
import { Shot, useBeat } from "../components/Shot";
import { BROWSER_WIDTH, SPOTS } from "./AppScene";

function Timeout() {
  const defaults = useBeat("fail-1");
  const ours = useBeat("fail-2");
  const half = (ours.to - ours.from) / 2;
  return (
    <CodePanel
      id="openai-client"
      focus={[
        { at: defaults.from, lines: [6, 6] },
        { at: ours.from, lines: [7, 7] },
        { at: ours.from + half, lines: [35, 35] },
      ]}
      notes={[
        { at: defaults.from + 14, line: 6, text: "SDK default: 10 min, 2 retries", color: "ember" },
        { at: ours.from + 8, line: 7, text: "8 seconds", color: "mint" },
        { at: ours.from + half + 8, line: 35, text: "no retries", color: "mint" },
      ]}
    />
  );
}

function Retry() {
  const line = useBeat("fail-3");
  return <RetryButton clickAt={line.from + 26} />;
}

function Fallback() {
  const line = useBeat("fail-4");
  return (
    <Clip
      name="fallback"
      from="loaded"
      width={BROWSER_WIDTH}
      url="localhost:3000/dashboard"
      zooms={[{ from: line.from + 40, to: line.to + 40, scale: 1.75, ...SPOTS.notice }]}
      labels={[{ from: line.from + 40, text: "OpenAI key made invalid on purpose", color: "sun" }]}
    />
  );
}

function NoFact() {
  const line = useBeat("fail-5");
  return (
    <Clip
      name="no-fact"
      width={BROWSER_WIDTH}
      url="localhost:3000/dashboard"
      zooms={[{ from: line.from + 50, to: line.to + 40, scale: 1.8, ...SPOTS.error }]}
      labels={[{ from: line.from + 50, text: "no earlier fact for Paprika", color: "lavender" }]}
    />
  );
}

function ServerLog() {
  const line = useBeat("fail-6");
  return (
    <CodePanel
      id="facts-generate"
      focus={[{ at: line.from, lines: [111, 116] }]}
      notes={[{ at: line.from + 16, line: 114, text: "server log only", color: "sun" }]}
    />
  );
}

function Cap() {
  const cap = useBeat("fail-7");
  const past = useBeat("fail-8");
  const half = (cap.to - cap.from) / 2;
  return (
    <CodePanel
      id="facts-limit"
      focus={[
        { at: cap.from, lines: [15, 17] },
        { at: cap.from + half, lines: [82, 90] },
        { at: past.from, lines: [103, 107] },
      ]}
      notes={[
        { at: cap.from + 30, line: 16, text: "20 facts per 10 minutes", color: "sun" },
        { at: past.from + 10, line: 106, text: "last fact, or try again later", color: "lavender" },
      ]}
    />
  );
}

export function FailureScene() {
  return (
    <>
      <Shot name="Timeout" from="fail-1" to="fail-2">
        <Timeout />
      </Shot>
      <Shot name="Retry" from="fail-3" to="fail-3">
        <Retry />
      </Shot>
      <Shot name="Fallback" from="fail-4" to="fail-4">
        <Fallback />
      </Shot>
      <Shot name="No fact" from="fail-5" to="fail-5">
        <NoFact />
      </Shot>
      <Shot name="Server log" from="fail-6" to="fail-6">
        <ServerLog />
      </Shot>
      <Shot name="Cap" from="fail-7" to="fail-8">
        <Cap />
      </Shot>
    </>
  );
}
