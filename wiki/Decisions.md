# Decisions

Dated log of meaningful choices. Newest first. Each entry: what was decided,
why, and what would make us revisit it.

## 2026-07-07 — Calendar: local store + heuristic fallback, Google as a seam

The smart calendar ([[Web-Apps]]) keeps events in a local JSON store by
default (`CALENDAR_PROVIDER=local`); Google Calendar is a drop-in provider
adapter, activated only when OAuth credentials appear. The chat assistant
runs the Agent SDK with in-process calendar tools on the same $0 local-login
path as the orchestrator (`AGENT_MODE=auto|mock|sdk`), degrading to a keyless
heuristic parser so the app works with zero auth. Built in the 2026-07-06
session (which hit its usage limit mid-verification); verified and committed
2026-07-07 — events REST plus a real Claude chat turn creating an event.

## 2026-07-07 — Orchestrator Phase 2: hooks in-memory, projects broadcast, lint aligned

Hook observation keeps its observed-session registry **in memory** (ghost
sessions are ephemeral by nature; the ws ring buffer already bounds event
history) and the forwarder (`orchestrator/hooks/forward.mjs`) always exits 0
fast so a down orchestrator can never slow a real Claude Code session.
Projects persist as JSON like workflows, and every mutation broadcasts a full
`project.update` frame — clients reconcile, no patch protocol. Deleting a
project intentionally does not broadcast (no deletion frame in the wire
contract; a stale client copy is harmless). Biome was aligned with reality:
`useLiteralKeys` off (the codebase standardized on bracket notation),
Tailwind CSS directives enabled for the parser, vendored `.claude/skills`
excluded; remaining calendar a11y findings are tracked in [[Ideas]].

## 2026-07-06 — Run strategies: Ralph faithful, Caveman as config

Phase 2's orchestrator "runner" setting offers DAG (default, now parallel
with agent→agent data passing), **Ralph** (Geoffrey Huntley's loop-until-done
technique over a spec/backlog), and **Caveman**. Research found no single
canonical Caveman semantics, so it is modeled as a config: a brute-force
re-invoke loop with a `doneMarker` and an optional token-compression flag.
Ralph loops over exactly the project progress tracker's backlog. Implemented
and verified 2026-07-07.

## 2026-07-06 — Higgsfield studio: Gemini images now, video adapter later

The Higgsfield clone ([[Web-Apps]]) generates images via the same Gemini REST
pattern [[Pin-Factory]] uses (raw fetch, `gemini-2.5-flash-image`), behind a
provider adapter: a keyless placeholder-SVG stub when no `GEMINI_API_KEY`, the real
generator when set. 14 curated camera/VFX presets ship as data; video (image→video
with camera motion) is a Phase-4 adapter left as a seam — `video` stays undefined
and the UI hides "Animate". Generated media is saved to a gitignored dir and served
via `/api/media`.

## 2026-07-06 — Finance app: manual-first, integer-cents, dataviz palette

The finance app ([[Web-Apps]]) stores money as integer minor units (cents)
everywhere to avoid float drift, separates personal vs business by a `ledger`
dimension, and works fully with manual entry + CSV import — no external keys. A
price provider (for live holdings prices) and bank-sync (Plaid/Teller) are
swappable adapters behind a seam, added only when wanted. Charts use the validated
data-viz palette (categorical fixed-order, one-axis-only, status colors with
labels) so the dashboard reads as one system. Revisit the store (JSON files) for
SQLite if write contention or multi-user shows up.

## 2026-07-06 — Two web apps added; framework exception carved out

`orchestrator/` + `higgsfield/` + `packages/` form an npm workspace of
React/Vite + Hono TypeScript apps — the first code in the repo that isn't
"Python stdlib + vanilla JS." Justified because both are genuinely app-shaped
(a live node-canvas; a generative-media studio) where a real framework buys
far more than it costs. Bounded so the stdlib projects and the `:8080`
dashboard stay vanilla and untouched (see CLAUDE.md "Framework exception" and
[[Web-Apps]]). Revisit if the workspace starts entangling the Python projects.

## 2026-07-06 — Orchestrator uses @anthropic-ai/claude-agent-sdk, not the API SDK

The orchestrator launches *real local Claude Code agents* (subprocesses with
filesystem access, a live message stream, and interrupt/stop control), so it
uses `@anthropic-ai/claude-agent-sdk`'s `query()`. The plain `@anthropic-ai/sdk`
was rejected: its hosted `beta.agents` run in Anthropic's containers, can't be
observed via Claude Code hooks, and don't share the Claude Code runtime the
"ghost flow" observation half depends on. The $0 path runs agents on local
Claude Code auth (`CLAUDE_CODE_OAUTH_TOKEN` or a prior `claude` login);
`claude-opus-4-8` is the default model.

## 2026-07-04 — Karpathy LLM-wiki pattern for the knowledge layer

Adopted the three-layer pattern (sources / Claude-maintained `wiki/` /
`CLAUDE.md` schema) with ingest–query–lint workflows. Graphify provides the
*automatic* code graph; the wiki is the *curated* layer for decisions and
intent. Revisit if the wiki goes stale — that means the ingest workflow
isn't being followed.

## 2026-07-04 — Homelab hosting via docker-compose

Dashboard served by nginx (with dotfile/`.env` blocking) + a poller
container running `fetch --watch`. Chosen over a hosted platform because
the user runs a homelab and the EONET study needs a long-lived poller.

## 2026-07-04 — Skills installed project-level, hooks withheld

ui-ux-pro-max, superpowers, and graphify skills copied into
`.claude/skills/` (committed, so any session gets them). Graphify's
PreToolUse hook was deliberately NOT auto-installed — startup-config
changes should be human-reviewed. Run `graphify install --project` locally
to opt in.

## 2026-07-04 — EONET before any betting

The prediction-market idea ([[Ideas]]) proceeds only if the latency study
shows the data is fresh enough. No bet automation will be built regardless;
jurisdiction check (Polymarket geo-blocks) is on the human.

## 2026-07-04 — Pinterest publishing: bulk CSV first, API later

CSV via Pinterest's native Bulk create avoids the developer-app approval
wait. The API publisher stays on the [[Ideas]] list. Revisit once the
account has traction.

## 2026-07-04 — Pin images: AI-only (Gemini), no template renderer

User chose AI-only over programmatic templates. Cost ≈ US$0.04/image after
free tier; risk is garbled in-image text, mitigated by short labels
(enforced by `src/validate.py`) and per-pin `--force` regeneration.

## 2026-07-04 — Monorepo, one repo for everything

Both products + dashboard + wiki in `jotinha280404/dasd` so work never
requires switching repos. Projects stay independent (own README,
requirements, no shared code).

## 2026-07-04 — Repo wiped for a clean slate

The original Vite/React "Painel de Usuários" scaffold (which had no `src/`
committed anyway) was deleted. History preserved in git.
