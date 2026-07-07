import type { AspectRatioValue, Generation } from "@dasd/higg-shared";
import { cn } from "@dasd/ui";
import { useIsMutating } from "@tanstack/react-query";
import { Download, Film, RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  GENERATE_MUTATION_KEY,
  useCapabilities,
  useDeleteGeneration,
  useGenerations,
} from "../api/queries";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { aspectToCss } from "../lib/aspect";
import { useUIStore } from "../store/ui";

function IconButton({
  title,
  onClick,
  disabled = false,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md bg-black/50 p-1.5 text-white backdrop-blur transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-black/70",
      )}
    >
      {children}
    </button>
  );
}

function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur",
        className,
      )}
    >
      {children}
    </span>
  );
}

function PendingTile({ aspectRatio }: { aspectRatio: AspectRatioValue }) {
  return (
    <div className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div
        className="relative flex w-full animate-pulse items-center justify-center bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-muted)]"
        style={{ aspectRatio: aspectToCss(aspectRatio) }}
      >
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    </div>
  );
}

function GenerationTile({ gen, capsReady }: { gen: Generation; capsReady: boolean }) {
  const remix = useUIStore((s) => s.remix);
  const animateGeneration = useUIStore((s) => s.animateGeneration);
  const del = useDeleteGeneration();
  const output = gen.outputs[0];
  const ratio = aspectToCss(gen.input.aspectRatio);
  const failed = gen.status === "failed";
  const active = gen.status === "running" || gen.status === "queued";
  const isVideo = gen.kind === "video";
  const durationSec = gen.input.durationSec ?? output?.durationSec;
  const canAnimate = gen.kind === "image" && gen.status === "succeeded" && Boolean(output);

  return (
    <div className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {output ? (
        output.mimeType.startsWith("video/") ? (
          <video
            src={output.url}
            controls
            loop
            muted
            playsInline
            className="w-full object-cover"
            style={{ aspectRatio: ratio }}
          />
        ) : (
          <img
            src={output.url}
            alt={gen.input.prompt || "generation"}
            loading="lazy"
            className="w-full object-cover"
            style={{ aspectRatio: ratio }}
          />
        )
      ) : (
        <div
          className="flex items-center justify-center bg-[var(--color-surface-2)] text-xs text-muted-foreground"
          style={{ aspectRatio: ratio }}
        >
          {failed ? (
            <span className="px-4 text-center text-[var(--color-destructive)]">
              {gen.error ? gen.error : "Generation failed"}
            </span>
          ) : active ? (
            <Spinner className="h-5 w-5" />
          ) : (
            "No output"
          )}
        </div>
      )}

      {/* Kind / duration / status badges — always visible, outside the hover overlay. */}
      {isVideo || active || failed ? (
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
          {isVideo ? <Badge>🎬 video</Badge> : null}
          {isVideo && durationSec ? <Badge>{durationSec}s</Badge> : null}
          {active ? (
            <Badge>
              <Spinner className="h-3 w-3" />
              {gen.status}
            </Badge>
          ) : failed ? (
            <Badge className="bg-[var(--color-destructive)]">failed</Badge>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="pointer-events-auto flex justify-end gap-1 p-2">
          <IconButton title="Remix into composer" onClick={() => remix(gen)}>
            <RotateCcw size={15} />
          </IconButton>
          {canAnimate ? (
            <IconButton
              title={capsReady ? "Animate — image to video" : "Animate — loading capabilities…"}
              disabled={!capsReady}
              onClick={() => animateGeneration(gen)}
            >
              <Film size={15} />
            </IconButton>
          ) : null}
          {output ? (
            <a
              href={output.url}
              download
              title="Download"
              className="rounded-md bg-black/50 p-1.5 text-white backdrop-blur transition-colors hover:bg-black/70"
            >
              <Download size={15} />
            </a>
          ) : null}
          <IconButton title="Delete" onClick={() => del.mutate(gen.id)}>
            <Trash2 size={15} />
          </IconButton>
        </div>
        {gen.input.prompt ? (
          <p className="line-clamp-3 p-3 text-xs text-white/90">{gen.input.prompt}</p>
        ) : null}
      </div>
    </div>
  );
}

export function GenerationFeed() {
  const generations = useGenerations();
  const caps = useCapabilities();
  const pendingCount = useIsMutating({ mutationKey: GENERATE_MUTATION_KEY });
  const aspectRatio = useUIStore((s) => s.aspectRatio);

  const capsReady = Boolean(caps.data);
  const items = generations.data ?? [];

  if (generations.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (generations.isError) {
    return (
      <EmptyState
        title="Couldn't reach the studio server"
        description="Start it with `npm run dev:higgsfield` from the repo root, then retry."
      />
    );
  }

  if (items.length === 0 && pendingCount === 0) {
    return (
      <EmptyState
        icon={<Film size={28} />}
        title="No generations yet"
        description="Describe a shot above and hit Generate — your frames will appear here."
      />
    );
  }

  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {Array.from({ length: pendingCount }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical stateless placeholders.
        <PendingTile key={`pending-${i}`} aspectRatio={aspectRatio} />
      ))}
      {items.map((gen) => (
        <GenerationTile key={gen.id} gen={gen} capsReady={capsReady} />
      ))}
    </div>
  );
}
