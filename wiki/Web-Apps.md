# Web Apps

Four TypeScript web apps live alongside the Python projects and the vanilla
[[Dashboard-and-Hosting|dashboard]]. They are the repo's **framework
exception** (see `CLAUDE.md`): one npm workspace, React/Vite front ends, Hono
back ends. The stdlib projects and the `:8080` dashboard are untouched.

## Orchestrator — agent-flow builder + live monitor

A visual, node-based canvas (n8n / CrewAI in spirit) where you compose an
**agent flow** — trigger → agents → tasks → tools → code → conditionals — then
press Run and watch **real Claude Code agents execute live on the canvas**:
status rings, animated edges, streamed token logs. It is the node editor and
the "watch agents collaborate" monitor in one — the same canvas in edit vs.
run mode.

Agents reach the canvas two ways under one event model:

- **Launched** — the flow engine calls `@anthropic-ai/claude-agent-sdk`'s
  `query()` per agent node; each is a real Claude Code subprocess it can
  stream, interrupt, and stop.
- **Observed** — your own `claude` terminal session POSTs Claude Code hook
  events to the server (wire it with `orchestrator/hooks/forward.mjs`) and
  shows up as a live, read-only "ghost" session in the UI.

Stack: React 19 + Vite 7 + React Flow 12 (web) · Hono + `ws` (server) ·
`@anthropic-ai/claude-agent-sdk`. See [[Decisions]] for why the Agent SDK and
not the plain API SDK.

## Higgsfield — generative-media studio

A separate app (no agents, no canvas): Soul-style photorealistic **image
generation** (real today, via Gemini), a camera-motion/VFX **preset gallery**,
a Pinterest-style **generation feed**, a **character library**, and — behind a
swappable provider adapter — **image→video** with camera-motion presets.

Stack: React 19 + Vite 7 (web) · Hono (server) · a `GeminiImageProvider` now,
a `fal.ai`/Veo video adapter later. The same `GEMINI_API_KEY` the
[[Pin-Factory]] uses drives image generation.

## Finance — personal + business tracker

A finance app (`finance/`) tracking **personal and business** ledgers side by
side: accounts, categorized transactions (with CSV import), investments/holdings
with gains, budgets, and goals. A charts dashboard (recharts, themed with the
validated dataviz palette) shows net worth over time, cashflow, and allocation; a
global ledger toggle (Personal / Business / All) drives every view. Works fully
with manual entry — no external keys; a price provider and bank-sync are swappable
adapters for later. Money is integer-cents throughout.

Stack: React 19 + Vite + recharts (web) · Hono + a JSON-file store (server).

## Calendar — message Claude to manage events

A smart calendar (`calendar/`): a month grid + agenda view (date-fns) with a
docked **chat panel** — you message Claude in plain language ("move my 3pm to
Thursday", "block 2 hours Friday for deep work") and it creates, moves, and
cancels events. The assistant runs the Agent SDK with **in-process calendar
tools** on the same $0 local-login path as the orchestrator; `AGENT_MODE`
(auto | mock | sdk) controls it, and a keyless heuristic parser answers when
no auth is present. Events live in a local JSON store by default; Google
Calendar is a drop-in provider adapter (OAuth client + token) left as a seam.

Stack: React 19 + Vite + date-fns (web) · Hono +
`@anthropic-ai/claude-agent-sdk` (server).

## Layout

One npm workspace rooted at the repo (`package.json` → `workspaces`):

- `packages/ui` — shared design system (`@dasd/ui`; Tailwind v4 tokens + primitives).
- `orchestrator/`, `higgsfield/`, `finance/`, `calendar/` — each app is three
  packages, `{shared,server,web}`: shared types, Hono back end, Vite front end.

## Ports

| | web (dev) | api (dev) | web (docker) | api (docker) |
|---|---|---|---|---|
| Orchestrator | 5173 | 8787 | 8081 | 8091 |
| Higgsfield | 5174 | 8788 | 8082 | 8092 |
| Finance | 5175 | 8789 | 8084 | 8094 |
| Calendar | 5176 | 8790 | 8083 | 8093 |

The `:8080` dashboard is unchanged.

## Running

Dev (hot reload, one command per app, from the repo root):

```bash
npm install                # once
npm run dev:orchestrator   # web :5173 + api :8787
npm run dev:higgsfield     # web :5174 + api :8788
npm run dev:finance        # web :5175 + api :8789
npm run dev:calendar       # web :5176 + api :8790
```

Docker (homelab, alongside the dashboard): `docker compose up -d` builds and
serves all four apps on the ports above. Keys come from the root `.env`.

## The $0 path

Nothing here requires paid API access to start:

- **Orchestrator** runs real agents on your local Claude Code auth — a
  `CLAUDE_CODE_OAUTH_TOKEN` (mint with `claude setup-token`) or a prior
  `claude` login — and hook observation is free. A metered `ANTHROPIC_API_KEY`
  is only an alternative.
- **Higgsfield** generates images on the Gemini free tier. Video sits behind
  an adapter that stays hidden until a `FAL_KEY` (or Veo access) is present.
- **Finance** needs no keys at all — manual entry + CSV import; prices and
  bank-sync are later adapters.
- **Calendar**'s assistant uses the same local Claude Code auth as the
  orchestrator and falls back to the keyless heuristic parser without it.

## Status

As of 2026-07-07:

**Committed and verified**

- Phase 0 — workspace scaffold (`9caaba6`).
- Phase 1 — **orchestrator MVP** (`c26678f`): React Flow canvas, seven node
  types, schema-driven inspector, live WebSocket agent stream. A real
  `claude-opus-4-8` agent ran end-to-end on local Claude Code auth; a keyless
  mock covers demos.
- Phase 7 — **finance app** (`f523786`): ledgers, accounts, transactions +
  CSV import, investments, budgets, goals, recharts dashboard — API verified.
- Phase 3 — **Higgsfield studio** (`aeaa215`): prompt composer, 14 camera/VFX
  presets, masonry generation feed, character library; real Gemini generation
  with a key, keyless placeholder stub without — verified end-to-end.
- Phase 6 — **calendar**: month grid + agenda + docked chat panel + event
  modal. Verified 2026-07-07: typecheck + build clean, events REST
  (list/create/delete) exercised, and a **real Claude chat turn**
  (`usedRealClaude: true`) created an event through the in-process tools with
  correct America/Sao_Paulo timezone math.
- Phase 2 — **orchestrator depth** (2026-07-07): selectable run strategies
  (`settings.runner`: DAG now parallel with agent→agent data passing; Ralph
  looping a project backlog to done; Caveman brute-force retry with a done
  marker + optional context compression), the **project progress tracker**
  (backlog store + `project.update` broadcasts + a live Progress drawer), and
  **hook observation** (`POST /api/hooks` + `orchestrator/hooks/forward.mjs`
  → live ghost sessions in the UI). Verified: 12/12 integration checks over
  REST **and** WebSocket in mock mode (Ralph drove a 3-item backlog to done
  in 3 iterations; Caveman exited on marker at iteration 1 and errored on
  exhaustion; two DAG agents ran in parallel; hook events appeared as a
  ghost), plus a full browser walkthrough — runner picked, project created
  inline, run watched to 100% · 3/3 done, ghost session log opened.

**Remaining**

- Phase 4 — Higgsfield image→video + character continuation.
- Phase 5 — polish / persistence / deploy (orchestrator ghost-flow canvas
  rendering and live permission prompts are on [[Ideas]]).

See [[Decisions]] for choices along the way.
