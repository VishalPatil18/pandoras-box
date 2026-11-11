import { CodePanel } from "../components/CodePanel";
import { DisplayText } from "../components/DisplayText";
import { Shot, useBeat } from "../components/Shot";
import { SqlPanel } from "../components/SqlPanel";

function UserModel() {
  const owned = useBeat("sch-1");
  const added = useBeat("sch-2");
  return (
    <CodePanel
      id="schema-user"
      focus={[
        { at: owned.from, lines: [10, 20] },
        { at: added.from, lines: [21, 26] },
      ]}
      notes={[
        { at: owned.from + 12, line: 13, text: "Better Auth", color: "lavender" },
        { at: added.from + 24, line: 22, text: "favorite movie", color: "sun" },
        { at: added.from + 60, line: 24, text: "generation lease", color: "mint" },
      ]}
    />
  );
}

function FactModel() {
  const intro = useBeat("sch-3");
  const row = useBeat("sch-4");
  const step = (row.to - row.from) / 3;
  return (
    <CodePanel
      id="schema-fact"
      focus={[
        { at: intro.from, lines: [80, 81] },
        { at: row.from, lines: [85, 85] },
        { at: row.from + step, lines: [86, 87] },
        { at: row.from + step * 2, lines: [89, 89] },
      ]}
      notes={[
        { at: intro.from + 10, line: 80, text: "a new row per fact", color: "sun" },
        { at: row.from + 6, line: 85, text: "title as typed", color: "lavender" },
        { at: row.from + step + 6, line: 87, text: "lowercased key", color: "mint" },
        { at: row.from + step * 2 + 6, line: 89, text: "set by the database", color: "sun" },
      ]}
    />
  );
}

function History() {
  const intro = useBeat("sch-5");
  const cache = useBeat("sch-6");
  const fallback = useBeat("sch-7");
  const prompt = useBeat("sch-8");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 46 }}>
      <DisplayText lines={["Three jobs, one table"]} size={92} at={intro.from} stagger={0.9} />
      <SqlPanel
        tags={[
          { at: cache.from, rows: [0], text: "newest row = cache", color: "mint" },
          { at: fallback.from, rows: [1, 2], text: "older rows = fallback", color: "sun" },
          { at: prompt.from, rows: [0], text: "last fact goes in the prompt", color: "lavender" },
        ]}
      />
    </div>
  );
}

function KeyChange() {
  const line = useBeat("sch-9");
  return (
    <CodePanel
      id="schema-fact"
      enterAt={0}
      focus={[{ at: line.from, lines: [86, 87] }]}
      notes={[{ at: line.from + 30, line: 87, text: "new movie, new key, cache misses", color: "ember" }]}
    />
  );
}

export function SchemaScene() {
  return (
    <>
      <Shot name="User model" from="sch-1" to="sch-2">
        <UserModel />
      </Shot>
      <Shot name="Fact model" from="sch-3" to="sch-4">
        <FactModel />
      </Shot>
      <Shot name="History" from="sch-5" to="sch-8">
        <History />
      </Shot>
      <Shot name="Key change" from="sch-9" to="sch-9">
        <KeyChange />
      </Shot>
    </>
  );
}
