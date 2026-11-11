import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { captureOf, Clip } from "../components/Clip";
import { DisplayText } from "../components/DisplayText";
import { PopIn, Shot, useBeat } from "../components/Shot";
import { Sticker } from "../components/Sticker";
import { CLAMP, EASE, FONT } from "../theme";

export const BROWSER_WIDTH = 1300;
// Element centers in the 1600x900 recordings, read off captured frames.
export const SPOTS = {
  profile: { x: 1200, y: 44 },
  title: { x: 520, y: 230 },
  ticket: { x: 800, y: 546 },
  badge: { x: 560, y: 628 },
  newFact: { x: 1086, y: 628 },
  onboardingField: { x: 520, y: 380 },
  editField: { x: 700, y: 214 },
  notice: { x: 560, y: 572 },
  error: { x: 520, y: 520 },
} as const;

function TitleCard() {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
      <div
        style={{
          scale: String(interpolate(frame, [0, 18], [0.4, 1], { ...CLAMP, easing: EASE.overshoot })),
          rotate: `${interpolate(frame, [0, 18], [-18, 0], { ...CLAMP, easing: EASE.out })}deg`,
          opacity: interpolate(frame, [0, 6], [0, 1], CLAMP),
        }}
      >
        <Img src={staticFile("logo.svg")} style={{ width: 150, height: 150 }} />
      </div>
      <DisplayText lines={["Pandoras", "Box"]} size={200} at={6} />
      <div
        style={{
          fontFamily: FONT.ui,
          fontWeight: 500,
          fontSize: 40,
          textAlign: "center",
          opacity: interpolate(frame, [30, 42], [0, 1], CLAMP),
          translate: interpolate(frame, [30, 44], ["0px 16px", "0px 0px"], { ...CLAMP, easing: EASE.out }),
        }}
      >
        Name one movie you love. Get a piece of trivia about it.
      </div>
      <PopIn at={22} rotate={-12} style={{ position: "absolute", left: -260, top: 170 }}>
        <Sticker icon="clapperboard" color="lavender" size={130} />
      </PopIn>
      <PopIn at={28} rotate={14} style={{ position: "absolute", right: -230, top: 120 }}>
        <Sticker icon="sparkles" color="sun" size={104} />
      </PopIn>
      <PopIn at={34} rotate={-8} style={{ position: "absolute", right: -190, bottom: 70 }}>
        <Sticker icon="film" color="ember" size={96} />
      </PopIn>
    </div>
  );
}

function Landing() {
  const hover = captureOf("landing").events[0];
  return (
    <Clip
      name="landing"
      from="loaded"
      width={BROWSER_WIDTH}
      url="localhost:3000"
      extraClicks={[{ at: ["hover", 0.6], x: hover.x, y: hover.y }]}
      labels={[{ from: 60, text: "Google OAuth via Better Auth", color: "sun" }]}
    />
  );
}

function Onboarding() {
  const checks = useBeat("app-3");
  const kept = useBeat("app-4");
  return (
    <Clip
      name="onboarding"
      from="loaded"
      to={["saved", 0.4]}
      width={BROWSER_WIDTH}
      url="localhost:3000/onboarding"
      zooms={[{ from: checks.from + 20, to: kept.to - 30, scale: 1.45, ...SPOTS.onboardingField }]}
      labels={[
        { from: checks.from + 30, text: "trim, then 1 to 100 chars", color: "lavender" },
        { from: kept.to - 70, text: "Amélie, kept as typed", color: "mint" },
      ]}
    />
  );
}

function Dashboard() {
  const line = useBeat("app-5");
  const third = (line.to - line.from) / 3;
  return (
    <Clip
      name="onboarding"
      from="dashboard"
      width={BROWSER_WIDTH}
      url="localhost:3000/dashboard"
      zooms={[
        { from: line.from, to: line.from + third, scale: 2.2, ...SPOTS.profile },
        { from: line.from + third + 10, to: line.from + third * 2, scale: 1.7, ...SPOTS.title },
      ]}
      labels={[
        { from: line.from + 8, to: line.from + third, text: "name, email and photo from Google", color: "lavender" },
        { from: line.from + third + 10, to: line.from + third * 2, text: "movie from Postgres", color: "sun" },
      ]}
    />
  );
}

function TicketReplay() {
  const line = useBeat("app-6");
  return (
    <Clip
      name="onboarding"
      from={["dashboard", -0.2]}
      width={BROWSER_WIDTH}
      url="localhost:3000/dashboard"
      zooms={[
        { from: 0, to: line.to - 50, scale: 1.45, ...SPOTS.ticket },
        { from: line.to - 50, to: line.to + 60, scale: 2.1, ...SPOTS.badge },
      ]}
      labels={[{ from: line.to - 50, text: "AI-generated badge", color: "lavender" }]}
    />
  );
}

export function AppScene() {
  return (
    <>
      <Shot name="Title" from="app-1" to="app-1" lead={24}>
        <TitleCard />
      </Shot>
      <Shot name="Landing" from="app-2" to="app-2">
        <Landing />
      </Shot>
      <Shot name="Onboarding" from="app-3" to="app-4">
        <Onboarding />
      </Shot>
      <Shot name="Dashboard" from="app-5" to="app-5">
        <Dashboard />
      </Shot>
      <Shot name="Ticket" from="app-6" to="app-6">
        <TicketReplay />
      </Shot>
    </>
  );
}

