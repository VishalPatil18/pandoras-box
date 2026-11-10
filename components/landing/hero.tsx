import { Icon } from "@/components/icons";
import { Sticker } from "@/components/sticker";
import { Marquee } from "@/components/landing/marquee";
import { Ribbon } from "@/components/landing/ribbon";
import { SignInButton } from "@/components/landing/sign-in-button";

export function Hero() {
  return (
    <main>
      <Marquee />
      <section className="grid min-h-[calc(100dvh-38px)] grid-rows-[auto_1fr_auto] bg-sky px-[clamp(16px,4vw,48px)] pb-12">
        <header className="py-5">
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-pill border border-carbon bg-paper"
          >
            <Icon name="box" />
          </span>
        </header>

        <div className="relative isolate grid items-center">
          <Ribbon />
          <h1 className="font-display text-[clamp(64px,13vw,240px)] leading-[0.8] uppercase">
            Pandoras
            <br />
            Box
          </h1>
          <Sticker
            icon="clapperboard"
            color="ember"
            rotate={-12}
            className="absolute top-[6%] right-[14%]"
          />
          <Sticker
            icon="sparkles"
            color="sun"
            rotate={9}
            className="absolute top-[46%] right-[4%]"
          />
          <Sticker
            icon="film"
            color="violet"
            rotate={-6}
            className="absolute bottom-[4%] left-[46%]"
          />
        </div>

        <div className="grid gap-6 pt-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <p className="max-w-[26ch] text-[clamp(20px,2.2vw,30px)] leading-[1.2]">
            Name one movie you love. Get a piece of trivia about it you probably haven&apos;t heard.
          </p>
          <SignInButton />
        </div>
      </section>
    </main>
  );
}
