# Web Apps

Two TypeScript web apps live alongside the Python projects and the vanilla
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
  events to the server and shows up as a live, read-only "ghost" flow.

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

## Layout

One npm workspace rooted at the repo (`package.json` → `workspaces`):

- `packages/ui` — shared design system (`@dasd/ui`; Tailwind v4 tokens + primitives).
- `orchestrator/{shared,server,web}` and `higgsfield/{shared,server,web}` —
  each app's shared types, Hono back end, and Vite front end.

## Ports

| | web (dev) | api (dev) | web (docker) | api (docker) |
|---|---|---|---|---|
| Orchestrator | 5173 | 8787 | 8081 | 8091 |
| Higgsfield | 5174 | 8788 | 8082 | 8092 |

The `:8080` dashboard is unchanged.

## Running

Dev (hot reload, one command per app, from the repo root):

```bash
npm install            # once
npm run dev:orchestrator   # web :5173 + api :8787
npm run dev:higgsfield     # web :5174 + api :8788
```

Docker (homelab, alongside the dashboard): `docker compose up -d` builds and
serves both apps on the ports above. Keys come from the root `.env`.

## The $0 path

Nothing here requires paid API access to start:

- **Orchestrator** runs real agents on your local Claude Code auth — a
  `CLAUDE_CODE_OAUTH_TOKEN` (mint with `claude setup-token`) or a prior
  `claude` login — and hook observation is free. A metered `ANTHROPIC_API_KEY`
  is only an alternative.
- **Higgsfield** generates images on the Gemini free tier. Video sits behind
  an adapter that stays hidden until a `FAL_KEY` (or Veo access) is present.

## Also planned

Two more apps will join this workspace on the same pattern: a **Smart Calendar**
(`calendar/`, ports 8083/8093 — connect a calendar and message Claude to create
events) and a **Finance** app (`finance/`, ports 8084/8094 — personal + business
accounts, investments, goals). Both reuse `@dasd/ui` and the docker/nginx setup.

## Status

Phase 0 (scaffolding) and **Phase 1 (orchestrator MVP)** are in. The orchestrator
has the React Flow canvas, the seven node types, a schema-driven inspector, and a
live WebSocket agent stream; a real `claude-opus-4-8` agent runs on local Claude
Code auth (verified end-to-end — status ring, animated edge, streamed tokens,
cost/usage), with a keyless mock agent for demos. Remaining: multi-agent flows +
selectable run strategies (DAG / Ralph / Caveman) + a project progress tracker,
then the Higgsfield studio, then Calendar and Finance. The phases are tracked in
the session task list; see [[Decisions]] for choices made along the way.
