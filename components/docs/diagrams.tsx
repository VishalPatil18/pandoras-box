import type { ReactNode } from "react";

// Hand-drawn SVG diagrams. They render inline on /docs and are exported to dev-docs/diagrams/.

const FILL = {
  paper: "#ffffff",
  sky: "#dceeff",
  lavender: "#e9ccff",
  mint: "#55db9c",
  sun: "#ffd731",
  mist: "#e9e9e9",
} as const;
type Tone = keyof typeof FILL;

// The one hue that carries meaning: the path that breaks.
const HOT = "#fb4903";

export const DIAGRAMS = {
  "system-architecture": {
    title: "System architecture",
    caption:
      "The browser only talks to the Next.js app. Every request passes the same session check, and only the server reaches Google, Postgres and OpenAI.",
  },
  "request-path": {
    title: "Request path for an API call",
    caption:
      "Every API route runs the same chain: session check, body validation, then the handler. Each failure leaves as one error shape.",
  },
  "data-model": {
    title: "Data model",
    caption:
      "Better Auth owns user, session and account. The app adds three columns to user (shaded) and its own fact table, which keeps every fact as history.",
  },
  "sign-in": {
    title: "Sign-in and routing",
    caption:
      "Google sends the user back to Better Auth, which writes a session row. The landing page then routes on one fact: whether a movie is saved.",
  },
  "fact-flow": {
    title: "How getFact decides",
    caption:
      "A request either serves a fresh fact, wins the lease and generates, or waits for the holder. Every failure path ends in the last saved fact or a clear error.",
  },
  "two-tabs": {
    title: "Two tabs, one OpenAI call",
    caption:
      "Two tabs hit two server instances at once. The lease lets only one call OpenAI; the other polls Postgres and returns the same fact.",
  },
  "lease-alternatives": {
    title: "Why a lease",
    caption:
      "Each rejected option breaks at a different edge (orange): two calls, a wasted call, or a connection held through the OpenAI call. The lease holds nothing while it waits.",
  },
  "cache-layers": {
    title: "Two cache layers",
    caption:
      "The browser answers within 30 seconds without a request. The server answers within 60 seconds without OpenAI. New fact skips only the browser layer.",
  },
  "movie-edit": {
    title: "Optimistic movie edit",
    caption:
      "Saving shows the new title at once and pauses the fact query. Success loads the new movie's fact; failure restores the old title and explains why.",
  },
} as const;

export type DiagramId = keyof typeof DIAGRAMS;

function Diagram({
  id,
  width,
  height,
  children,
}: {
  id: DiagramId;
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={DIAGRAMS[id].caption}
      className="h-auto w-full min-w-[640px]"
    >
      <defs>
        <marker
          id={`${id}-arrow`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
        <marker
          id={`${id}-hot`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill={HOT} />
        </marker>
      </defs>
      {children}
    </svg>
  );
}

function Box({
  x,
  y,
  w,
  h,
  title,
  note,
  tone = "paper",
  dashed,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  note?: string;
  tone?: Tone;
  dashed?: boolean;
}) {
  const cx = x + w / 2;
  const titleY = note ? y + h / 2 - 3 : y + h / 2 + 4.5;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={FILL[tone]}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <text
        x={cx}
        y={titleY}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="currentColor"
      >
        {title}
      </text>
      {note && (
        <text x={cx} y={titleY + 16} textAnchor="middle" fontSize={11.5} fill="currentColor">
          {note}
        </text>
      )}
    </g>
  );
}

function Choice({
  cx,
  cy,
  w,
  h,
  label,
}: {
  cx: number;
  cy: number;
  w: number;
  h: number;
  label: string;
}) {
  const points = `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
  return (
    <g>
      <polygon points={points} fill={FILL.paper} stroke="currentColor" strokeWidth={1.5} />
      <text
        x={cx}
        y={cy + 4.5}
        textAnchor="middle"
        fontSize={12.5}
        fontWeight={700}
        fill="currentColor"
      >
        {label}
      </text>
    </g>
  );
}

function Arrow({
  id,
  d,
  hot,
  dashed,
}: {
  id: DiagramId;
  d: string;
  hot?: boolean;
  dashed?: boolean;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={hot ? HOT : "currentColor"}
      strokeWidth={1.5}
      strokeDasharray={dashed ? "5 4" : undefined}
      markerEnd={`url(#${id}-${hot ? "hot" : "arrow"})`}
    />
  );
}

// A white halo keeps labels readable where they cross a line.
function Label({
  x,
  y,
  children,
  anchor = "middle",
  bold,
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={11.5}
      fontWeight={bold ? 700 : 500}
      fill="currentColor"
      stroke="#ffffff"
      strokeWidth={4}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}

function Pill({
  x,
  y,
  w,
  text,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  text: string;
  tone: "mint" | "hot";
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={24}
        rx={12}
        fill={tone === "mint" ? FILL.mint : HOT}
        stroke="currentColor"
        strokeWidth={1.2}
      />
      <text
        x={x + w / 2}
        y={y + 16}
        textAnchor="middle"
        fontSize={11.5}
        fontWeight={700}
        fill={tone === "mint" ? "currentColor" : "#ffffff"}
      >
        {text}
      </text>
    </g>
  );
}

export function SystemArchitecture() {
  const id = "system-architecture";
  return (
    <Diagram id={id} width={860} height={450}>
      <rect
        x={210}
        y={40}
        width={410}
        height={370}
        rx={14}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray="6 5"
      />
      <Label x={226} y={62} anchor="start" bold>
        Vercel: one Next.js app
      </Label>
      <Label x={604} y={62} anchor="end">
        secrets stay on this side
      </Label>

      <Box x={20} y={180} w={150} h={80} tone="sky" title="Browser" note="React, TanStack Query" />

      <Box x={230} y={80} w={180} h={54} title="Pages" note="server components" />
      <Box x={420} y={80} w={180} h={54} title="API routes" note="/api/me, /api/fact" />
      <Box
        x={230}
        y={162}
        w={370}
        h={54}
        tone="lavender"
        title="withUser + requireUser()"
        note="session cookie to user, or 401 and redirect"
      />
      <Box x={230} y={244} w={180} h={54} title="lib/facts.ts" note="cache, lease, cap" />
      <Box x={420} y={244} w={180} h={54} title="lib/auth.ts" note="Better Auth" />
      <Box x={230} y={326} w={180} h={54} title="lib/openai.ts" note="8 s timeout, no retries" />
      <Box x={420} y={326} w={180} h={54} title="lib/db.ts" note="Prisma on a pg pool" />

      <Box x={670} y={48} w={170} h={60} title="Google OAuth" note="consent, profile" />
      <Box
        x={670}
        y={200}
        w={170}
        h={80}
        tone="mint"
        title="Supabase Postgres"
        note="RLS on every table"
      />
      <Box x={670} y={340} w={170} h={60} tone="sun" title="OpenAI" note="Responses API" />

      <Arrow id={id} d="M170 206 H190 V107 H208" />
      <Label x={186} y={150} anchor="end">
        HTTPS +
      </Label>
      <Label x={186} y={164} anchor="end">
        cookie
      </Label>

      <Arrow id={id} d="M95 180 V14 H755 V46" dashed />
      <Label x={432} y={30}>
        browser redirect for Google consent
      </Label>

      <Arrow id={id} d="M320 134 V160" />
      <Arrow id={id} d="M510 134 V160" />
      <Arrow id={id} d="M320 216 V242" />
      <Arrow id={id} d="M510 216 V242" />
      <Arrow id={id} d="M320 298 V324" />
      <Arrow id={id} d="M380 298 L455 324" />
      <Arrow id={id} d="M510 298 V324" />

      <Arrow id={id} d="M600 271 H625 V78 H668" />
      <Label x={621} y={152} anchor="end">
        code for profile
      </Label>

      <Arrow id={id} d="M600 353 H645 V240 H668" />
      <Label x={650} y={312} anchor="start">
        pooled SQL
      </Label>

      <Arrow id={id} d="M320 380 V424 H755 V402" />
      <Label x={540} y={442}>
        prompt with the title as quoted data
      </Label>
    </Diagram>
  );
}

export function RequestPath() {
  const id = "request-path";
  return (
    <Diagram id={id} width={860} height={300}>
      <Box x={20} y={60} w={130} h={56} tone="sky" title="API request" note="cookie attached" />
      <Box x={190} y={60} w={150} h={56} tone="lavender" title="withUser()" note="lib/http.ts" />
      <Box x={380} y={60} w={150} h={56} title="requireUser()" note="session to user" />
      <Box x={570} y={60} w={130} h={56} title="handler" note="Zod parses the body" />
      <Box x={740} y={60} w={100} h={56} tone="mint" title="200 JSON" />

      <Arrow id={id} d="M150 88 H188" />
      <Arrow id={id} d="M340 88 H378" />
      <Arrow id={id} d="M530 88 H568" />
      <Arrow id={id} d="M700 88 H738" />

      <Box x={380} y={200} w={150} h={56} title="401" note="UNAUTHENTICATED" />
      <Box
        x={560}
        y={200}
        w={150}
        h={56}
        title="400, 409, 429, 503"
        note="AppError, its own status"
      />
      <Box x={730} y={200} w={120} h={56} title="500 INTERNAL" note="logged, generic text" />

      <Arrow id={id} d="M455 116 V198" hot />
      <Label x={461} y={160} anchor="start">
        no session
      </Label>
      <Arrow id={id} d="M635 116 V198" hot />
      <Label x={641} y={150} anchor="start">
        AppError
      </Label>
      <Arrow id={id} d="M690 116 L775 198" hot />
      <Label x={742} y={150} anchor="start">
        unexpected
      </Label>

      <Label x={615} y={286}>
        {"Every error body is { error: { code, message, issues? } }"}
      </Label>
    </Diagram>
  );
}

type Column = { name: string; type: string; added?: boolean };

function Table({
  x,
  y,
  w,
  title,
  columns,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  columns: Column[];
}) {
  const ROW = 20;
  const HEAD = 30;
  return (
    <g>
      {columns.map((column, i) =>
        column.added ? (
          <rect
            key={column.name}
            x={x}
            y={y + HEAD + i * ROW}
            width={w}
            height={ROW}
            fill={FILL.lavender}
          />
        ) : null,
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={HEAD + columns.length * ROW + 6}
        rx={10}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <line x1={x} y1={y + HEAD} x2={x + w} y2={y + HEAD} stroke="currentColor" strokeWidth={1.2} />
      <text x={x + 12} y={y + 20} fontSize={13} fontWeight={700} fill="currentColor">
        {title}
      </text>
      {columns.map((column, i) => (
        <g key={column.name}>
          <text x={x + 12} y={y + HEAD + 14 + i * ROW} fontSize={12} fill="currentColor">
            {column.name}
          </text>
          <text
            x={x + w - 12}
            y={y + HEAD + 14 + i * ROW}
            textAnchor="end"
            fontSize={11.5}
            fill="currentColor"
          >
            {column.type}
          </text>
        </g>
      ))}
    </g>
  );
}

export function DataModel() {
  const id = "data-model";
  return (
    <Diagram id={id} width={860} height={360}>
      <Table
        x={30}
        y={20}
        w={250}
        title="user"
        columns={[
          { name: "id", type: "PK" },
          { name: "name, email, image", type: "from Google" },
          { name: "createdAt, updatedAt", type: "timestamps" },
          { name: "favoriteMovie", type: "varchar(100), null", added: true },
          { name: "factLeaseUntil", type: "timestamptz, null", added: true },
          { name: "factLeaseToken", type: "text, null", added: true },
        ]}
      />
      <Table
        x={580}
        y={20}
        w={250}
        title="fact"
        columns={[
          { name: "id", type: "PK" },
          { name: "userId", type: "FK to user" },
          { name: "movieTitle", type: "as typed" },
          { name: "movieKey", type: "lowercased" },
          { name: "text", type: "the trivia" },
          { name: "createdAt", type: "set by now()" },
        ]}
      />
      <Label x={705} y={196}>
        index (userId, movieKey, createdAt DESC)
      </Label>
      <Table
        x={30}
        y={240}
        w={250}
        title="session"
        columns={[
          { name: "token", type: "unique" },
          { name: "userId", type: "FK to user" },
          { name: "expiresAt", type: "timestamp" },
        ]}
      />
      <Table
        x={330}
        y={240}
        w={220}
        title="account"
        columns={[
          { name: "userId", type: "FK to user" },
          { name: "providerId", type: "google" },
          { name: "tokens", type: "from Google" },
        ]}
      />

      <Arrow id={id} d="M280 60 H578" />
      <Label x={429} y={52}>
        one user, many facts (cascade delete)
      </Label>
      <Arrow id={id} d="M155 176 V238" />
      <Label x={161} y={212} anchor="start">
        many sessions
      </Label>
      <Arrow id={id} d="M240 176 V196 H440 V238" />
      <Label x={340} y={190}>
        one Google account
      </Label>

      <rect
        x={600}
        y={262}
        width={18}
        height={14}
        fill={FILL.lavender}
        stroke="currentColor"
        strokeWidth={1}
      />
      <Label x={626} y={274} anchor="start">
        columns the app adds
      </Label>
    </Diagram>
  );
}

export function SignIn() {
  const id = "sign-in";
  return (
    <Diagram id={id} width={860} height={290}>
      <Box x={20} y={40} w={130} h={56} tone="sky" title="/" note="landing page" />
      <Box x={185} y={40} w={140} h={56} title="Google" note="account picker" />
      <Box
        x={360}
        y={40}
        w={170}
        h={56}
        tone="lavender"
        title="/api/auth/callback"
        note="Better Auth"
      />
      <Box x={565} y={40} w={120} h={56} title="/" note="reads the session" />
      <Choice cx={770} cy={68} w={130} h={80} label="movie saved?" />

      <Arrow id={id} d="M150 68 H183" />
      <Label x={167} y={30}>
        Sign in
      </Label>
      <Arrow id={id} d="M325 68 H358" />
      <Label x={342} y={30}>
        code
      </Label>
      <Arrow id={id} d="M530 68 H563" />
      <Label x={547} y={30}>
        cookie
      </Label>
      <Arrow id={id} d="M685 68 H703" />

      <Box
        x={360}
        y={190}
        w={170}
        h={56}
        tone="mint"
        title="Postgres"
        note="user, account, session"
      />
      <Arrow id={id} d="M445 96 V188" />
      <Label x={451} y={146} anchor="start">
        upsert user, insert session
      </Label>

      <Box x={560} y={190} w={130} h={56} title="/onboarding" note="pick a movie" />
      <Box x={710} y={190} w={120} h={56} tone="sky" title="/dashboard" />
      <Arrow id={id} d="M770 108 V188" />
      <Label x={776} y={150} anchor="start">
        yes
      </Label>
      <Arrow id={id} d="M740 96 L640 188" />
      <Label x={672} y={140} anchor="end">
        no
      </Label>
      <Arrow id={id} d="M690 218 H708" />
      <Label x={700} y={270}>
        PUT /api/me/movie, then dashboard
      </Label>
    </Diagram>
  );
}

export function FactFlow() {
  const id = "fact-flow";
  return (
    <Diagram id={id} width={890} height={600}>
      <Box x={175} y={16} w={150} h={44} tone="sky" title="GET /api/fact" />
      <Choice cx={250} cy={110} w={210} h={64} label="fact under 60 s old?" />
      <Box x={400} y={88} w={140} h={44} tone="mint" title="return cache" />
      <Box
        x={165}
        y={175}
        w={170}
        h={52}
        tone="lavender"
        title="claim lease"
        note="one conditional UPDATE"
      />
      <Choice cx={250} cy={278} w={170} h={60} label="won the lease?" />
      <Choice cx={250} cy={360} w={190} h={60} label="20 facts in 10 min?" />
      <Box x={10} y={338} w={120} h={44} title="last fact, or 429" />
      <Box
        x={165}
        y={420}
        w={170}
        h={52}
        tone="sun"
        title="call OpenAI"
        note="8 s timeout, no retries"
      />
      <Box x={10} y={424} w={120} h={44} title="last fact, or 503" />
      <Box x={150} y={520} w={200} h={44} tone="mint" title="store, return generated" />
      <Label x={250} y={590}>
        the holder releases the lease in finally
      </Label>

      <Arrow id={id} d="M250 60 V76" />
      <Arrow id={id} d="M355 110 H398" />
      <Label x={376} y={102}>
        yes
      </Label>
      <Arrow id={id} d="M250 142 V173" />
      <Label x={256} y={162} anchor="start">
        no
      </Label>
      <Arrow id={id} d="M250 227 V246" />
      <Arrow id={id} d="M250 308 V328" />
      <Label x={256} y={322} anchor="start">
        yes
      </Label>
      <Arrow id={id} d="M155 360 H132" hot />
      <Label x={143} y={352}>
        yes
      </Label>
      <Arrow id={id} d="M250 390 V418" />
      <Label x={256} y={408} anchor="start">
        no
      </Label>
      <Arrow id={id} d="M165 446 H132" hot />
      <Label x={148} y={438}>
        fails
      </Label>
      <Arrow id={id} d="M250 472 V518" />
      <Label x={256} y={500} anchor="start">
        ok
      </Label>

      <Arrow id={id} d="M335 278 H568" />
      <Label x={452} y={270}>
        no: someone else is generating
      </Label>
      <Box
        x={570}
        y={252}
        w={150}
        h={52}
        tone="lavender"
        title="wait 500 ms"
        note="no connection held"
      />
      <Choice cx={645} cy={370} w={170} h={60} label="fact appeared?" />
      <Box x={760} y={348} w={110} h={44} tone="mint" title="return shared" />
      <Choice cx={645} cy={460} w={150} h={56} label="lease free?" />
      <Choice cx={645} cy={545} w={140} h={52} label="9 s passed?" />
      <Box x={420} y={523} w={120} h={44} title="last fact, or 503" />

      <Arrow id={id} d="M645 304 V338" />
      <Arrow id={id} d="M730 370 H758" />
      <Label x={744} y={362}>
        yes
      </Label>
      <Arrow id={id} d="M645 400 V430" />
      <Label x={651} y={420} anchor="start">
        no
      </Label>
      <Arrow id={id} d="M570 460 H420 V360 H347" />
      <Label x={495} y={452}>
        yes: take over
      </Label>
      <Arrow id={id} d="M645 488 V517" />
      <Label x={651} y={507} anchor="start">
        no
      </Label>
      <Arrow id={id} d="M575 545 H542" hot />
      <Label x={558} y={537}>
        yes
      </Label>
      <Arrow id={id} d="M715 545 H880 V278 H722" dashed />
      <Label x={872} y={430} anchor="end">
        no: poll again
      </Label>
    </Diagram>
  );
}

function Lifeline({ x, title, tone = "paper" }: { x: number; title: string; tone?: Tone }) {
  return (
    <g>
      <Box x={x - 60} y={16} w={120} h={36} title={title} tone={tone} />
      <line
        x1={x}
        y1={52}
        x2={x}
        y2={392}
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="3 4"
      />
    </g>
  );
}

function Message({
  id,
  from,
  to,
  y,
  label,
  reply,
}: {
  id: DiagramId;
  from: number;
  to: number;
  y: number;
  label: string;
  reply?: boolean;
}) {
  const end = to > from ? to - 2 : to + 2;
  return (
    <g>
      <Arrow id={id} d={`M${from} ${y} H${end}`} dashed={reply} />
      <Label x={(from + to) / 2} y={y - 6}>
        {label}
      </Label>
    </g>
  );
}

export function TwoTabs() {
  const id = "two-tabs";
  const TAB1 = 60;
  const A = 190;
  const AI = 330;
  const DB = 470;
  const B = 630;
  const TAB2 = 790;
  return (
    <Diagram id={id} width={850} height={400}>
      <Lifeline x={TAB1} title="Tab 1" tone="sky" />
      <Lifeline x={A} title="Server A" />
      <Lifeline x={AI} title="OpenAI" tone="sun" />
      <Lifeline x={DB} title="Postgres" tone="mint" />
      <Lifeline x={B} title="Server B" />
      <Lifeline x={TAB2} title="Tab 2" tone="sky" />

      <Message id={id} from={TAB1} to={A} y={80} label="GET /api/fact" />
      <Message id={id} from={TAB2} to={B} y={92} label="GET /api/fact" />
      <Message id={id} from={A} to={DB} y={112} label="claim lease" />
      <Message id={id} from={DB} to={A} y={134} label="won" reply />
      <Message id={id} from={B} to={DB} y={124} label="claim lease" />
      <Message id={id} from={DB} to={B} y={150} label="lost" reply />
      <Message id={id} from={A} to={AI} y={166} label="generate" />

      <rect
        x={458}
        y={176}
        width={184}
        height={86}
        rx={8}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <Label x={550} y={192}>
        every 500 ms
      </Label>
      <Message id={id} from={B} to={DB} y={222} label="fresh fact?" />
      <Message id={id} from={DB} to={B} y={250} label="none" reply />

      <Message id={id} from={AI} to={A} y={214} label="fact text" reply />
      <Message id={id} from={A} to={DB} y={262} label="insert, release" />
      <Message id={id} from={A} to={TAB1} y={290} label="generated" />
      <Message id={id} from={B} to={DB} y={300} label="fresh fact?" />
      <Message id={id} from={DB} to={B} y={324} label="found" reply />
      <Message id={id} from={B} to={TAB2} y={350} label="shared, same text" />

      <Pill x={265} y={362} w={130} text="1 OpenAI call" tone="mint" />
    </Diagram>
  );
}

function Panel({
  x,
  y,
  title,
  chosen,
  children,
}: {
  x: number;
  y: number;
  title: string;
  chosen?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={410}
        height={200}
        rx={14}
        fill={chosen ? "#eafbf2" : FILL.paper}
        stroke="currentColor"
        strokeWidth={chosen ? 2.5 : 1.2}
      />
      <text x={x + 16} y={y + 26} fontSize={13.5} fontWeight={700} fill="currentColor">
        {title}
      </text>
      {children}
    </g>
  );
}

export function LeaseAlternatives() {
  const id = "lease-alternatives";
  return (
    <Diagram id={id} width={860} height={440}>
      <Panel x={10} y={10} title="In-memory lock">
        <Pill x={270} y={14} w={130} text="2 OpenAI calls" tone="hot" />
        <Box x={30} y={60} w={130} h={44} title="Server A" note="its own lock" />
        <Box x={30} y={140} w={130} h={44} title="Server B" note="its own lock" />
        <Box x={280} y={100} w={110} h={44} tone="sun" title="OpenAI" />
        <Arrow id={id} d="M160 82 L278 114" hot />
        <Arrow id={id} d="M160 162 L278 130" hot />
        <Label x={220} y={124}>
          both call
        </Label>
      </Panel>

      <Panel x={440} y={10} title="Unique constraint">
        <Pill x={700} y={14} w={130} text="2 calls, 1 row" tone="hot" />
        <Box x={460} y={60} w={90} h={40} title="Tab 1" />
        <Box x={460} y={150} w={90} h={40} title="Tab 2" />
        <Box x={600} y={105} w={90} h={40} tone="sun" title="OpenAI" />
        <Box x={740} y={105} w={90} h={40} tone="mint" title="Postgres" />
        <Arrow id={id} d="M550 80 L598 117" />
        <Arrow id={id} d="M550 170 L598 133" hot />
        <Arrow id={id} d="M690 118 H738" />
        <Arrow id={id} d="M690 134 H738" hot />
        <Label x={714} y={168}>
          2nd insert rejected
        </Label>
      </Panel>

      <Panel x={10} y={225} title="Advisory lock">
        <Pill x={230} y={229} w={170} text="connection held 8 s" tone="hot" />
        <Box x={30} y={270} w={100} h={44} title="Request" />
        <Box x={170} y={270} w={100} h={44} tone="mint" title="Postgres" />
        <Box x={300} y={270} w={100} h={44} tone="sun" title="OpenAI" />
        <Arrow id={id} d="M130 292 H168" />
        <Label x={149} y={284}>
          lock
        </Label>
        <Arrow id={id} d="M80 314 V336 H350 V316" />
        <Label x={215} y={330}>
          then calls OpenAI, up to 8 s
        </Label>
        <rect x={30} y={350} width={370} height={22} rx={6} fill={HOT} />
        <text x={215} y={365} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#ffffff">
          transaction open through the call, past Prisma&apos;s 5 s limit
        </text>
      </Panel>

      <Panel x={440} y={225} title="Lease (chosen)" chosen>
        <Pill x={680} y={229} w={150} text="1 call, nothing held" tone="mint" />
        <Box x={460} y={268} w={90} h={40} title="Tab 1" />
        <Box x={460} y={355} w={90} h={40} title="Tab 2" />
        <Box x={600} y={310} w={100} h={44} tone="mint" title="Postgres" note="one UPDATE" />
        <Box x={740} y={268} w={90} h={40} tone="sun" title="OpenAI" />
        <Arrow id={id} d="M550 288 L598 322" />
        <Label x={566} y={296} anchor="start">
          won
        </Label>
        <Arrow id={id} d="M550 375 L598 344" dashed />
        <Label x={566} y={378} anchor="start">
          lost: polls
        </Label>
        <Arrow id={id} d="M555 280 H738" />
        <Label x={646} y={274}>
          then calls once
        </Label>
      </Panel>
    </Diagram>
  );
}

export function CacheLayers() {
  const id = "cache-layers";
  return (
    <Diagram id={id} width={860} height={250}>
      <Box x={20} y={95} w={130} h={56} tone="sky" title="Dashboard" note="needs a fact" />
      <Box
        x={200}
        y={60}
        w={200}
        h={126}
        tone="lavender"
        title="Browser cache"
        note="TanStack Query, 30 s"
      />
      <Box
        x={450}
        y={60}
        w={200}
        h={126}
        tone="mint"
        title="Server window"
        note="newest row, 60 s"
      />
      <Box x={700} y={95} w={140} h={56} tone="sun" title="OpenAI" note="generate and store" />

      <Arrow id={id} d="M150 123 H198" />
      <Arrow id={id} d="M400 123 H448" />
      <Label x={424} y={115}>
        stale
      </Label>
      <Arrow id={id} d="M650 123 H698" />
      <Label x={674} y={115}>
        stale
      </Label>

      <Arrow id={id} d="M300 60 V30" />
      <Label x={300} y={20}>
        fresh: shown at once, no request
      </Label>
      <Arrow id={id} d="M550 60 V30" />
      <Label x={550} y={20}>
        fresh: no OpenAI call
      </Label>

      <Arrow id={id} d="M85 151 V215 H550 V188" dashed />
      <Label x={320} y={236}>
        New fact: refetch() skips the browser cache, never the server window
      </Label>
    </Diagram>
  );
}

export function MovieEdit() {
  const id = "movie-edit";
  return (
    <Diagram id={id} width={860} height={262}>
      <Box x={20} y={100} w={120} h={50} title="Viewing" />
      <Box x={220} y={100} w={120} h={50} title="Editing" />
      <Box x={420} y={100} w={140} h={50} tone="lavender" title="Saving" note="new title shown" />
      <Box x={660} y={34} w={180} h={50} tone="mint" title="Saved" note="new movie's fact loads" />
      <Box x={660} y={166} w={180} h={50} title="Rolled back" note="old title, toast says why" />

      <Arrow id={id} d="M140 118 H218" />
      <Label x={179} y={110}>
        Edit
      </Label>
      <Arrow id={id} d="M260 150 C260 196 90 196 90 152" />
      <Label x={175} y={210}>
        Cancel or Escape
      </Label>
      <Arrow id={id} d="M250 100 C250 62 310 62 310 98" />
      <Label x={280} y={58}>
        invalid: inline error
      </Label>
      <Arrow id={id} d="M340 125 H418" />
      <Label x={379} y={117}>
        Save
      </Label>
      <Label x={490} y={172}>
        fact query paused
      </Label>

      <Arrow id={id} d="M560 112 L658 64" />
      <Label x={604} y={78}>
        200
      </Label>
      <Arrow id={id} d="M560 138 L658 186" hot />
      <Label x={604} y={180}>
        error
      </Label>

      <Arrow id={id} d="M750 34 V14 H60 V98" dashed />
      <Arrow id={id} d="M750 216 V244 H60 V152" dashed />
      <Label x={400} y={240}>
        back to Viewing
      </Label>
    </Diagram>
  );
}

export const DIAGRAM_COMPONENTS: Record<DiagramId, () => ReactNode> = {
  "system-architecture": SystemArchitecture,
  "request-path": RequestPath,
  "data-model": DataModel,
  "sign-in": SignIn,
  "fact-flow": FactFlow,
  "two-tabs": TwoTabs,
  "lease-alternatives": LeaseAlternatives,
  "cache-layers": CacheLayers,
  "movie-edit": MovieEdit,
};

// Figure wrapper for the docs page: wide drawings scroll on phones instead of shrinking.
export function DiagramFigure({ id }: { id: DiagramId }) {
  const Drawing = DIAGRAM_COMPONENTS[id];
  return (
    <figure className="my-8">
      <div className="overflow-x-auto rounded-card border border-carbon bg-paper p-4 text-carbon">
        <Drawing />
      </div>
      <figcaption className="mt-3 text-sm text-ink-soft">
        <span className="font-bold text-carbon">{DIAGRAMS[id].title}.</span> {DIAGRAMS[id].caption}
      </figcaption>
    </figure>
  );
}
