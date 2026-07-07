# Repo schema — read this first

Monorepo with two products and a knowledge layer:

| Layer | Where | Who owns it |
|---|---|---|
| Raw sources (immutable-ish) | `pin-factory/`, `eonet-tracker/`, `index.html` | human + Claude, via normal dev |
| **Wiki** (curated knowledge) | `wiki/*.md` | **Claude-maintained**, human-read |
| Schema (this file) | `CLAUDE.md` | changes rarely, on purpose |
| **Web apps** (framework exception) | `orchestrator/`, `higgsfield/`, `finance/`, `calendar/`, `packages/` | human + Claude; React/Vite/Hono — see below |

The wiki follows the LLM-wiki pattern
(karpathy/442a6bf555914893e9891c11519de94f): the tedious part of a knowledge
base is bookkeeping, so Claude does the bookkeeping. It is browsable in
Obsidian (open the repo root as a vault) and on the dashboard's Wiki tab.

## Wiki workflows (do these without being asked)

- **Ingest** — after completing any meaningful piece of work (feature,
  decision, discovery, gotcha): update the relevant `wiki/` page(s), add a
  dated entry to [[Decisions]] if a choice was made, and keep `[[wikilinks]]`
  between related pages intact. Small diffs, in the same commit as the work.
- **Query** — when asked about the project ("how does X work", "why did we
  do Y"), read the wiki first, then the code. For code-structure questions,
  `graphify-out/graph.json` exists — prefer `/graphify query` when available.
- **Lint** — when touching the wiki, watch for contradictions with the code,
  stale claims, orphan pages (nothing links to them), and broken wikilinks.
  Fix what you find; note anything uncertain in the page itself.

## Wiki rules

- Pages are short and factual; prose over bullets-of-bullets. One concept
  per page; link instead of duplicating.
- `[[Wikilink]]` targets are file names in `wiki/` without `.md`.
- Never move/rename wiki pages without updating every inbound link.
- `wiki/Home.md` is the index — every page must be reachable from it.
- `wiki/index.json` lists all pages (the dashboard's Wiki tab reads it);
  update it whenever a page is added or removed.

## Project conventions

- Python, stdlib + `requests` only; no frameworks. Each project is
  self-contained under its folder with its own README and `requirements.txt`.
- The dashboard (`index.html`) is a single self-contained file: vanilla JS,
  no build step, no external requests except NASA's EONET API.
- Generated artifacts that can be rebuilt in one command (Obsidian vault,
  graphify cache) are gitignored; their rebuild commands live in the README.
- Secrets only in `.env` files (gitignored). Nothing in `.env` is ever
  needed by the dashboard.

## Framework exception — the web apps

`orchestrator/`, `higgsfield/`, `finance/`, `calendar/`, and `packages/` are
the **only** place the "Python stdlib + vanilla JS, no build step" rule does
**not** apply. They are one npm workspace (root `package.json`) of TypeScript
apps (React 19 + Vite front ends, Hono back ends), each split into
`{shared,server,web}` packages:

- **orchestrator/** — visual node-based agent-flow builder + live monitor for
  real Claude Code agents (React Flow; `ws`; `@anthropic-ai/claude-agent-sdk`).
  Web `:8081`, API `:8091` in docker.
- **higgsfield/** — generative-media studio (a Gemini image adapter now, a
  video adapter later). Web `:8082`, API `:8092`.
- **finance/** — personal + business ledgers: accounts, transactions + CSV
  import, investments, budgets, goals (recharts; integer-cents; JSON store).
  Web `:8084`, API `:8094`.
- **calendar/** — month/agenda calendar with a Claude chat assistant that
  creates/moves/cancels events (Agent SDK in-process tools; keyless heuristic
  fallback). Web `:8083`, API `:8093`.
- **packages/ui** — the shared design system (Tailwind v4 tokens + primitives).

Keep the repo coherent: the workspace must never reach into `pin-factory/`,
`eonet-tracker/`, or `index.html` — those stay vanilla and untouched. Each app
keeps its own `.env` (gitignored); nothing there is needed by the `:8080`
dashboard. Dev: `npm run dev:<app>` (orchestrator | higgsfield | finance |
calendar) from the repo root. Full story, ports, current status, and the $0
run path in [[Web-Apps]].
