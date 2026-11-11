// Reads the real project files by line range and highlights them, so the video shows actual code.
// Rerun after editing any of these files: npm run code
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHighlighter, type ThemeRegistration } from "shiki";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(import.meta.dirname, "../src/code.json");

// Brand palette on a Carbon card: sticker colors carry the syntax roles.
const THEME: ThemeRegistration = {
  name: "pandoras",
  type: "dark",
  colors: { "editor.background": "#000000", "editor.foreground": "#f4f4f4" },
  settings: [
    { settings: { foreground: "#f4f4f4" } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#8c8c8c", fontStyle: "italic" } },
    { scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.operator.new"], settings: { foreground: "#e9ccff" } },
    { scope: ["string", "string.template", "punctuation.definition.string"], settings: { foreground: "#55db9c" } },
    { scope: ["constant.numeric", "constant.language", "variable.other.constant"], settings: { foreground: "#ffd731" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call entity.name.function"], settings: { foreground: "#4da2ff" } },
    { scope: ["entity.name.type", "support.type", "entity.name.class", "support.class"], settings: { foreground: "#ff8a5c" } },
    { scope: ["keyword.operator", "punctuation"], settings: { foreground: "#bdbdbd" } },
    { scope: ["variable.other.property", "meta.object-literal.key", "support.type.property-name"], settings: { foreground: "#dceeff" } },
    { scope: ["keyword.other.sql", "keyword.other.DML.sql", "keyword.other.DDL.sql"], settings: { foreground: "#e9ccff" } },
  ],
};

type Range = [number, number];
type Excerpt = { file: string; lang: "typescript" | "prisma"; ranges: Range[] };

const EXCERPTS: Record<string, Excerpt> = {
  "schema-user": { file: "prisma/schema.prisma", lang: "prisma", ranges: [[10, 30]] },
  "schema-fact": { file: "prisma/schema.prisma", lang: "prisma", ranges: [[80, 93]] },
  "facts-fresh": { file: "lib/facts.ts", lang: "typescript", ranges: [[38, 51]] },
  "facts-lease": { file: "lib/facts.ts", lang: "typescript", ranges: [[61, 80]] },
  "facts-get": { file: "lib/facts.ts", lang: "typescript", ranges: [[138, 157]] },
  "facts-generate": { file: "lib/facts.ts", lang: "typescript", ranges: [[98, 123]] },
  "facts-limit": { file: "lib/facts.ts", lang: "typescript", ranges: [[15, 17], [82, 90], [103, 107]] },
  "test-lease": { file: "tests/backend/facts-lease.test.ts", lang: "typescript", ranges: [[43, 54]] },
  "openai-client": { file: "lib/openai.ts", lang: "typescript", ranges: [[5, 9], [31, 37]] },
  "api-request": { file: "lib/api.ts", lang: "typescript", ranges: [[17, 28], [50, 65]] },
  "queries-fact": { file: "lib/queries.ts", lang: "typescript", ranges: [[8, 8], [27, 36]] },
  "queries-mutate": { file: "lib/queries.ts", lang: "typescript", ranges: [[38, 53]] },
};

type Token = { t: string; c: string };
// A row is either a numbered source line or a fold marker between ranges.
type Row = { n: number; tokens: Token[] } | { n: null; tokens: [] };

const highlighter = await createHighlighter({ themes: [THEME], langs: ["typescript", "prisma"] });

const output: Record<string, { file: string; rows: Row[] }> = {};
for (const [id, excerpt] of Object.entries(EXCERPTS)) {
  const source = readFileSync(join(ROOT, excerpt.file), "utf8").split("\n");
  // Highlight the whole file once so multi-line constructs keep the right colors.
  const lines = highlighter.codeToTokensBase(source.join("\n"), { lang: excerpt.lang, theme: "pandoras" });
  const rows: Row[] = [];
  excerpt.ranges.forEach(([from, to], index) => {
    if (index > 0) rows.push({ n: null, tokens: [] });
    for (let n = from; n <= to; n++) {
      rows.push({ n, tokens: lines[n - 1].map((token) => ({ t: token.content, c: token.color ?? "#f4f4f4" })) });
    }
  });
  output[id] = { file: excerpt.file, rows };
}

writeFileSync(OUT, JSON.stringify(output));
console.log(`Wrote ${Object.keys(output).length} code excerpts to src/code.json`);
