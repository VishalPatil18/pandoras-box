import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocsContent, SECTIONS, Walkthrough } from "@/components/docs/content";
import { OnThisPage } from "@/components/docs/on-this-page";

describe("docs page", () => {
  it("renders a titled section for every entry in On this page", () => {
    const { container } = render(<DocsContent repoUrl="https://example.com/repo" />);

    for (const section of SECTIONS) {
      const element = container.querySelector(`section#${CSS.escape(section.id)}`);
      expect(element, section.id).not.toBeNull();
      expect(element?.querySelector("h2")?.textContent).toBe(section.title);
    }
  });

  it("links every section from the On this page pane", () => {
    render(<OnThisPage sections={SECTIONS} />);

    const nav = screen.getByRole("navigation", { name: "On this page" });
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(SECTIONS.map((section) => `#${section.id}`));
  });

  it("shows a placeholder until a video ID is set, then a privacy-enhanced embed", () => {
    const { rerender } = render(<Walkthrough videoId={null} />);
    expect(screen.getByText("Walkthrough video coming soon")).toBeInTheDocument();

    rerender(<Walkthrough videoId="abc123" />);
    expect(screen.getByTitle("Pandoras Box walkthrough")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc123",
    );
  });
});
