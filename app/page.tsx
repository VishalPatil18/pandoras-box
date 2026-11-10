// Placeholder that proves fonts and tokens load. The real landing page replaces it.
export default function Home() {
  return (
    <main className="min-h-dvh bg-sky px-6 py-12 md:px-12">
      <h1 className="font-display text-[clamp(64px,13vw,240px)] leading-[0.8] uppercase">
        Pandoras
        <br />
        Box
      </h1>
      <p className="mt-8 max-w-[26ch] text-2xl leading-tight">
        Name one movie you love. Get a piece of trivia about it you probably haven&apos;t heard.
      </p>
      <span className="mt-8 inline-flex rounded-pill border border-carbon bg-sun px-4 py-2 text-sm font-bold tracking-[0.03em]">
        Coming soon
      </span>
    </main>
  );
}
