import { Clip } from "../components/Clip";
import { CodePanel } from "../components/CodePanel";
import { Shot, useBeat } from "../components/Shot";
import { BROWSER_WIDTH, SPOTS } from "./AppScene";

function TypedClient() {
  const extra = useBeat("web-1");
  const contract = useBeat("web-2");
  const half = (contract.to - contract.from) / 2;
  return (
    <CodePanel
      id="api-request"
      focus={[
        { at: extra.from, lines: [50, 65] },
        { at: contract.from, lines: [62, 64] },
        { at: contract.from + half, lines: [17, 18] },
      ]}
      notes={[
        { at: extra.from + 10, line: 50, text: "Variant B, built as an extra", color: "lavender" },
        { at: contract.from + 8, line: 62, text: "same Zod schema as the server", color: "mint" },
        { at: contract.from + half + 8, line: 18, text: "one typed error", color: "sun" },
      ]}
    />
  );
}

function ClientCache() {
  const line = useBeat("web-3");
  const half = (line.to - line.from) / 2;
  return (
    <CodePanel
      id="queries-fact"
      focus={[
        { at: line.from, lines: [8, 8] },
        { at: line.from + half, lines: [30, 32] },
      ]}
      notes={[
        { at: line.from + 10, line: 8, text: "30 seconds", color: "sun" },
        { at: line.from + half + 8, line: 30, text: "keyed by movie", color: "mint" },
      ]}
    />
  );
}

function Countdown() {
  const line = useBeat("web-4");
  return (
    <Clip
      name="edit"
      to={["editing", -0.8]}
      width={BROWSER_WIDTH}
      url="localhost:3000/dashboard"
      zooms={[{ from: line.from + 20, to: line.to + 40, scale: 2.4, ...SPOTS.newFact }]}
      labels={[{ from: line.from + 30, text: "secondsUntilRefresh from the server", color: "sun" }]}
    />
  );
}

function OptimisticEdit() {
  const optimistic = useBeat("web-5");
  const paused = useBeat("web-6");
  const loaded = useBeat("web-7");
  return (
    <Clip
      name="edit"
      from={["editing", -0.9]}
      width={BROWSER_WIDTH}
      url="localhost:3000/dashboard"
      zooms={[
        { from: optimistic.from, to: paused.from, scale: 1.5, ...SPOTS.editField },
        { from: loaded.from, to: loaded.to + 40, scale: 1.35, ...SPOTS.ticket },
      ]}
      labels={[
        { from: paused.from, to: loaded.from, text: "title updates before the server answers", color: "lavender" },
        { from: loaded.from + 10, text: "new movie, new fact", color: "mint" },
      ]}
    />
  );
}

function Rollback() {
  const line = useBeat("web-8");
  return (
    <CodePanel
      id="queries-mutate"
      focus={[
        { at: line.from, lines: [44, 49] },
        { at: line.from + 34, lines: [51, 53] },
      ]}
      notes={[
        { at: line.from + 8, line: 46, text: "keep the old title", color: "sun" },
        { at: line.from + 40, line: 52, text: "put it back on failure", color: "ember" },
      ]}
    />
  );
}

export function BrowserScene() {
  return (
    <>
      <Shot name="Typed client" from="web-1" to="web-2">
        <TypedClient />
      </Shot>
      <Shot name="Client cache" from="web-3" to="web-3">
        <ClientCache />
      </Shot>
      <Shot name="Countdown" from="web-4" to="web-4">
        <Countdown />
      </Shot>
      <Shot name="Optimistic edit" from="web-5" to="web-7">
        <OptimisticEdit />
      </Shot>
      <Shot name="Rollback" from="web-8" to="web-8">
        <Rollback />
      </Shot>
    </>
  );
}
