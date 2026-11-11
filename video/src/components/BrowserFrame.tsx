import type { ReactNode } from "react";
import { C, FONT } from "../theme";

export const CHROME_HEIGHT = 50;

// A browser window in the sticker style: black outline, flat chrome, brand-colored dots.
export function BrowserFrame({ width, height, url, children }: { width: number; height: number; url: string; children: ReactNode }) {
  return (
    <div
      style={{
        width,
        borderRadius: 22,
        border: `2.5px solid ${C.carbon}`,
        background: C.paper,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: CHROME_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 20px",
          borderBottom: `2px solid ${C.carbon}`,
        }}
      >
        <div style={{ display: "flex", gap: 9 }}>
          {[C.ember, C.sun, C.mint].map((color) => (
            <div key={color} style={{ width: 15, height: 15, borderRadius: 99, background: color, border: `1.5px solid ${C.carbon}` }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 620,
            margin: "0 auto",
            height: 32,
            borderRadius: 1600,
            background: C.mist,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: FONT.ui,
            fontWeight: 500,
            fontSize: 18,
            color: C.inkSoft,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.inkSoft} strokeWidth="2.5" strokeLinecap="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          {url}
        </div>
        <div style={{ width: 63 }} />
      </div>
      <div style={{ position: "relative", width, height, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
