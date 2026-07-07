# Ideas

Backlog and open questions. Move an item to [[Decisions]] when it's settled.

## Active

- **Climate-event prediction markets** — the idea that spawned
  [[EONET-Tracker]]: if satellite-derived event data is visible before
  markets price it, that's an edge. Gated on the latency study result.
  Open questions: Is Polymarket legally available in the user's
  jurisdiction? Do market resolution criteria actually match satellite
  observations? (Both must be yes before anything else happens.)
- **Pin performance feedback loop** — once pins are live: pull Pinterest
  analytics, find which topics/formats/languages get saves and outbound
  clicks, generate more of what works.

## Pin Factory pipeline

- Pinterest API publisher (skip the CSV step) — needs business-app approval
- Auto-pick trending topics from Pinterest Trends
- Per-product affiliate pins (specific items instead of search links)
- A/B test titles per pin

## EONET / data

- Segment latency by *source* (JTWC vs IRWIN vs GDACS), not just category —
  some lanes are probably much faster than others
- Add USGS + FIRMS pollers for a primary-source comparison baseline
- Alerting: push a notification when a new event matching a watchlist
  (category + region + magnitude) appears

## Web apps

- Calendar a11y cleanup — `npm run lint` still reports ~18 findings, all in
  `calendar/` (labels without controls, click handlers on static elements,
  a hook-deps warning, one unused private member in the Google provider
  stub). Everything else in the repo is lint-clean ([[Web-Apps]]).
- Orchestrator: render observed ("ghost") sessions as read-only canvas
  flows, not just a log panel; live permission-prompt answering over the
  existing `permission` wire frame.

## Infra

- Reverse proxy + HTTPS in the homelab (Caddy/Traefik) in front of the
  dashboard ([[Dashboard-and-Hosting]])
- Nightly cron that rebuilds the graphify graph and re-exports the
  Obsidian vault
