"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

type DocSection = { id: string; title: string };

// A section counts as current once its top passes this line, just under the sticky offset.
const ACTIVE_LINE_PX = 120;

export function OnThisPage({ sections }: { sections: readonly DocSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    function update() {
      let current = sections[0]?.id;
      for (const section of sections) {
        const top = document.getElementById(section.id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= ACTIVE_LINE_PX) current = section.id;
      }
      setActive(current);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [sections]);

  return (
    <nav aria-label="On this page">
      <p className="mb-3 text-xs font-bold tracking-[0.08em] uppercase">On this page</p>
      <ol className="grid gap-0.5 border-l border-carbon/20">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 border-transparent py-1 pl-3 text-sm leading-snug text-ink-soft transition-colors hover:text-carbon",
                active === section.id && "border-carbon font-bold text-carbon",
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
