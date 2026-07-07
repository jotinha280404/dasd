# Decisions

Dated log of meaningful choices. Newest first. Each entry: what was decided,
why, and what would make us revisit it.

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
