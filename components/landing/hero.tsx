import Image from "next/image";
import landingBackground from "@/public/landing-bg.jpg";
import { HeroTitle } from "@/components/landing/hero-title";
import { SignInButton, SignInLink } from "@/components/landing/sign-in-button";

const REPO_URL = "https://github.com/VishalPatil18/pandoras-box";
const FOOTER_LINK =
  "rounded-sm underline-offset-4 hover:underline focus-visible:outline-paper cursor-pointer";

// One screen: the painting fills it edge to edge, nothing scrolls, everything sits on top.
export function Hero() {
  return (
    <main className="relative isolate flex h-dvh flex-col overflow-hidden text-paper">
      <Image
        src={landingBackground}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        className="-z-20 object-cover object-[30%_bottom]"
      />

      <header className="flex justify-end p-4 md:p-7">
        <SignInButton />
      </header>

      <section className="relative isolate md:-mt-6">
        <div className="px-5 md:px-12">
          <HeroTitle />
        </div>
        <p className="mt-5 max-w-[34ch] animate-in px-5 text-justify delay-700 duration-700 ease-out-expo fill-mode-both fade-in slide-in-from-bottom-2 text-[clamp(19px,2.3vw,32px)] leading-[1.25] font-medium [text-shadow:0_1px_12px_rgb(16_24_80/0.45)] md:mt-7 md:px-12">
          Name one movie you love. Get a piece of trivia about it you probably haven&apos;t heard.
        </p>
      </section>

      <footer className="mt-auto flex flex-wrap items-end justify-between gap-x-6 gap-y-3 bg-carbon/55 px-5 py-[31px] text-sm backdrop-blur-sm md:px-12 md:py-[37px] md:text-base">
        <div className="grid gap-1.5">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1 font-bold">
            <SignInLink className={FOOTER_LINK} />
            <a className={FOOTER_LINK} href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
              Docs
            </a>
            <a
              className={FOOTER_LINK}
              href={`${REPO_URL}/blob/main/CHANGELOG.md`}
              target="_blank"
              rel="noreferrer"
            >
              Changelog
            </a>
            <a className={FOOTER_LINK} href={REPO_URL} target="_blank" rel="noreferrer">
              Github
            </a>
          </nav>
          <p>&copy; 2026 Pandoras Box</p>
        </div>
        <p>
          Built by{" "}
          <a
            className={`${FOOTER_LINK} font-bold underline`}
            href="https://vishalpatil.tech/"
            target="_blank"
            rel="noreferrer"
          >
            Vishal
          </a>
        </p>
      </footer>
    </main>
  );
}
