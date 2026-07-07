import { Button } from "@dasd/ui";
import { useEffect, useState } from "react";

export function App() {
  const [health, setHealth] = useState("checking…");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { ok: boolean; ts: string }) =>
        setHealth(d.ok ? `up · ${new Date(d.ts).toLocaleTimeString()}` : "down"),
      )
      .catch(() => setHealth("unreachable — is the server running? (npm run dev:higgsfield)"));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex items-center gap-3">
        <span className="text-4xl">🎬</span>
        <h1 className="text-3xl font-semibold tracking-tight">Higgsfield</h1>
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        Generative-media studio. Phase&nbsp;0 scaffold — real Gemini image generation, the preset
        gallery, and the generation feed land in Phase&nbsp;3.
      </p>
      <p className="text-xs text-muted-foreground">
        server: <span className="text-foreground">{health}</span>
      </p>
      <Button>Scaffold is live</Button>
    </div>
  );
}
