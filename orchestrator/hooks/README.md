# Orchestrator hook forwarder

`forward.mjs` is a dependency-free Node script that Claude Code hooks pipe
their JSON into; it POSTs the payload to the orchestrator server
(`${ORCHESTRATOR_URL:-http://localhost:8787}/api/hooks`) with a 1500ms timeout
and always exits 0, so it can never block or fail your session.

## Wiring it up

Add the hooks below to `~/.claude/settings.json` (create the `hooks` key if it
does not exist), replacing `<abs path>` with the absolute path to this folder
— e.g. `C:/Users/you/repo/orchestrator/hooks` or `/home/you/repo/orchestrator/hooks`:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node <abs path>/forward.mjs" }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node <abs path>/forward.mjs" }] }
    ],
    "PreToolUse": [
      { "hooks": [{ "type": "command", "command": "node <abs path>/forward.mjs" }] }
    ],
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "node <abs path>/forward.mjs" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node <abs path>/forward.mjs" }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "node <abs path>/forward.mjs" }] }
    ]
  }
}
```

If the orchestrator API runs somewhere other than `http://localhost:8787`, set
`ORCHESTRATOR_URL` in your environment.

Observed sessions appear as read-only ghost agents (`cc:<session id>`) in the
orchestrator UI.
