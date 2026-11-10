import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DIAGRAM_COMPONENTS, type DiagramId } from "@/components/docs/diagrams";

const FONT = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

// Outside the page there's no CSS: give the file its own ink, font and white ground.
function toStandaloneSvg(markup: string): string {
  const standalone = markup
    .replace(' class="h-auto w-full min-w-[640px]"', "")
    .replace("<svg ", `<svg font-family="${FONT}" color="#000000" `)
    .replace("</defs>", '</defs><rect width="100%" height="100%" fill="#ffffff"/>');
  return `${standalone}\n`;
}

// `pnpm docs:diagrams` rewrites the files; a plain run fails when one is out of date.
describe("exported diagrams", () => {
  for (const [id, Drawing] of Object.entries(DIAGRAM_COMPONENTS) as [
    DiagramId,
    () => React.ReactNode,
  ][]) {
    it(`dev-docs/diagrams/${id}.svg matches the component`, async () => {
      const svg = toStandaloneSvg(renderToStaticMarkup(<Drawing />));
      await expect(svg).toMatchFileSnapshot(`../../dev-docs/diagrams/${id}.svg`);
    });
  }
});
