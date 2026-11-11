import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DocsContent, SECTIONS, Walkthrough } from "@/components/docs/content";
import { OnThisPage } from "@/components/docs/on-this-page";
import { REPO_URL } from "@/components/landing/hero";
import logo from "@/design/logo/pandoras-box.svg";

// The walkthrough on YouTube: https://youtu.be/hk047uCOHls
const WALKTHROUGH_VIDEO_ID: string | null = "hk047uCOHls";

const COLUMN = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

export const metadata: Metadata = {
  title: "Docs | Pandoras Box",
  description:
    "How Pandoras Box works: the architecture, the lease that stops duplicate OpenAI calls, and every design decision with its reasons.",
};

// Public: nothing here reads the session.
export default function DocsPage() {
  return (
    <main className="bg-paper">
      <header className="bg-sky pb-10 md:pb-14">
        <div className={COLUMN}>
          <nav className="flex items-center justify-between gap-3 py-4 md:py-5">
            <Link
              href="/"
              className="rounded-sm font-display text-lg leading-none uppercase sm:text-xl"
            >
              Pandoras Box
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-pill border border-carbon bg-paper px-4 py-1.5 text-sm font-bold"
            >
              GitHub
            </a>
          </nav>

          <div className="mt-6 flex flex-col items-start gap-5 sm:flex-row sm:items-center md:mt-10">
            <Image
              src={logo}
              alt=""
              width={96}
              height={96}
              priority
              className="size-20 md:size-24"
            />
            <h1 className="font-display text-[clamp(34px,5vw,60px)] leading-[0.95] uppercase">
              How Pandoras Box works
            </h1>
          </div>

          <div className="mt-8 mx-auto w-full max-w-[720px] md:mt-10">
            <Walkthrough videoId={WALKTHROUGH_VIDEO_ID} />
          </div>
        </div>
      </header>

      <div
        className={`${COLUMN} grid gap-10 pt-10 pb-24 lg:pt-16 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-14`}
      >
        <details className="rounded-card border border-carbon p-4 lg:hidden">
          <summary className="cursor-pointer font-bold">On this page</summary>
          <ol className="mt-3 grid gap-1.5 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="underline-offset-4 hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </details>

        <article className="docs-prose min-w-0">
          <DocsContent repoUrl={REPO_URL} />
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <OnThisPage sections={SECTIONS} />
          </div>
        </aside>
      </div>
    </main>
  );
}
