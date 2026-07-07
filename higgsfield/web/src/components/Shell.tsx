import { cn } from "@dasd/ui";
import { Camera, Clapperboard, Sparkles, Users, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useCapabilities } from "../api/queries";
import { useUIStore, type Tab } from "../store/ui";

const NAV: { tab: Tab; label: string; icon: ReactNode }[] = [
  { tab: "create", label: "Create", icon: <Sparkles size={18} /> },
  { tab: "presets", label: "Presets", icon: <Clapperboard size={18} /> },
  { tab: "characters", label: "Characters", icon: <Users size={18} /> },
];

const TAB_SUBTITLES: Record<Tab, string> = {
  create: "Compose a prompt and generate cinematic frames",
  presets: "Camera-motion & VFX presets for your shots",
  characters: "Reusable identities for a consistent cast",
};

export function Shell({ children }: { children: ReactNode }) {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  const caps = useCapabilities();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showBanner = caps.data?.image.isStub === true && !bannerDismissed;

  return (
    <div className="flex min-h-screen bg-[var(--color-background)] text-foreground">
      <aside className="sticky top-0 flex h-screen w-16 flex-col gap-2 border-r border-[var(--color-border)] bg-[var(--color-surface)] py-4 md:w-56 md:px-3">
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="text-2xl">🎬</span>
          <span className="hidden text-sm font-semibold tracking-tight md:inline">Higgsfield</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-1 md:px-0">
          {NAV.map((item) => (
            <button
              key={item.tab}
              type="button"
              onClick={() => setTab(item.tab)}
              title={item.label}
              aria-current={tab === item.tab ? "page" : undefined}
              className={cn(
                "flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:justify-start",
                tab === item.tab
                  ? "bg-[var(--color-surface-2)] text-foreground"
                  : "text-muted-foreground hover:bg-[var(--color-surface-2)] hover:text-foreground",
              )}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
          <div className="flex flex-col">
            <h1 className="text-base font-semibold capitalize leading-tight">{tab}</h1>
            <p className="text-xs text-muted-foreground">{TAB_SUBTITLES[tab]}</p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Camera size={16} />
            <span>{caps.data ? caps.data.image.model : "…"}</span>
          </div>
        </header>

        {showBanner ? (
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-6 py-2 text-xs text-[var(--color-warning)]">
            <span className="flex-1">
              Placeholder mode — add <code className="font-mono font-semibold">GEMINI_API_KEY</code>{" "}
              in <code className="font-mono font-semibold">higgsfield/server/.env</code> for real
              images.
            </span>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
