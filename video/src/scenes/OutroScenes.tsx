import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Clip } from "../components/Clip";
import { DisplayText } from "../components/DisplayText";
import { PopIn, Shot, useBeat } from "../components/Shot";
import { Sticker, type IconName } from "../components/Sticker";
import { C, CLAMP, EASE, FONT, type StickerColor } from "../theme";
import { BROWSER_WIDTH } from "./AppScene";

function Tradeoffs() {
  const session = useBeat("tr-2");
  const waiters = useBeat("tr-3");
  return (
    <Clip
      name="readme"
      from={["tradeoffs", -1.6]}
      to={["more-hours", -1.5]}
      width={BROWSER_WIDTH}
      url="README.md"
      zooms={[{ from: 0, to: 9999, scale: 1.5, x: 800, y: 450 }]}
      labels={[
        { from: session.from + 6, to: waiters.from, text: "session checked next to the data", color: "lavender" },
        { from: waiters.from + 6, text: "waiters share the winner's fact", color: "sun" },
      ]}
    />
  );
}

function MoreHours() {
  const line = useBeat("tr-4");
  const third = (line.to - line.from) / 3;
  return (
    <Clip
      name="readme"
      from={["more-hours", -1.5]}
      width={BROWSER_WIDTH}
      url="README.md"
      zooms={[{ from: 0, to: 9999, scale: 1.55, x: 800, y: 280 }]}
      labels={[
        { from: line.from + 20, to: line.from + third, text: "TMDB lookup", color: "sun" },
        { from: line.from + third, to: line.from + third * 2, text: "Playwright through sign-in", color: "lavender" },
        { from: line.from + third * 2, text: "shared rate limit store", color: "mint" },
      ]}
    />
  );
}

export function TradeoffsScene() {
  return (
    <>
      <Shot name="Tradeoffs" from="tr-1" to="tr-3">
        <Tradeoffs />
      </Shot>
      <Shot name="With 2 more hours" from="tr-4" to="tr-4">
        <MoreHours />
      </Shot>
    </>
  );
}

function ThankYou() {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
      <DisplayText lines={["Thank", "you"]} size={250} at={6} stagger={2.2} />
      <div style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 46, opacity: interpolate(frame, [30, 42], [0, 1], CLAMP) }}>for the opportunity</div>
      <PopIn at={24} rotate={-12} style={{ position: "absolute", left: -250, top: 60 }}>
        <Sticker icon="sparkles" color="sun" size={124} />
      </PopIn>
      <PopIn at={30} rotate={10} style={{ position: "absolute", right: -240, top: 200 }}>
        <Sticker icon="clapperboard" color="lavender" size={130} />
      </PopIn>
      <PopIn at={36} rotate={-6} style={{ position: "absolute", left: -170, bottom: 30 }}>
        <Sticker icon="check" color="mint" size={92} />
      </PopIn>
    </div>
  );
}

const LINKS: { icon: IconName; color: StickerColor; label: string; url: string }[] = [
  { icon: "globe", color: "sun", label: "Portfolio", url: "vishalpatil.tech" },
  { icon: "linkedin", color: "blue", label: "LinkedIn", url: "linkedin.com/in/vishalrameshpatil" },
  { icon: "github", color: "lavender", label: "GitHub", url: "github.com/VishalPatil18" },
];

function EndCard() {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: interpolate(frame, [0, 10], [0, 1], CLAMP) }}>
        <Img src={staticFile("logo.svg")} style={{ width: 92, height: 92 }} />
        <span style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 30, letterSpacing: "0.06em" }}>BUILT BY</span>
      </div>
      <DisplayText lines={["Vishal Patil"]} size={150} at={4} stagger={1.4} />
      <div style={{ display: "flex", flexDirection: "column", gap: 22, width: 1180 }}>
        {LINKS.map((link, i) => {
          const at = 22 + i * 7;
          const primary = i === 0;
          return (
            <div
              key={link.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                height: 108,
                padding: "0 34px 0 18px",
                borderRadius: 1600,
                border: `3px solid ${C.carbon}`,
                background: primary ? C.carbon : C.paper,
                color: primary ? C.paper : C.carbon,
                opacity: interpolate(frame, [at, at + 8], [0, 1], CLAMP),
                translate: interpolate(frame, [at, at + 16], ["0px 34px", "0px 0px"], { ...CLAMP, easing: EASE.out }),
              }}
            >
              <Sticker icon={link.icon} color={link.color} size={74} rotate={i % 2 ? 6 : -6} />
              <span style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 26, letterSpacing: "0.06em", width: 210, flexShrink: 0, opacity: 0.7 }}>{link.label.toUpperCase()}</span>
              <span style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 44, letterSpacing: "-0.01em" }}>{link.url}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OutroScene() {
  return (
    <>
      <Shot name="Thank you" from="end-1" to="end-3">
        <ThankYou />
      </Shot>
      <Shot name="End card" from="end-4" to="end-5" tail={240} fadeOut={false}>
        <EndCard />
      </Shot>
    </>
  );
}
