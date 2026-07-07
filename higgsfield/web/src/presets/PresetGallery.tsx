import { Button, cn } from "@dasd/ui";
import type { CameraPreset, PresetCategoryValue } from "@dasd/higg-shared";
import { Check, Clapperboard } from "lucide-react";
import { usePresets } from "../api/queries";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { useUIStore } from "../store/ui";

const CATEGORY_ORDER: PresetCategoryValue[] = ["camera", "vfx", "transition"];
const CATEGORY_LABELS: Record<PresetCategoryValue, string> = {
  camera: "Camera motion",
  vfx: "VFX",
  transition: "Transitions",
};

function groupByCategory(
  presets: CameraPreset[],
): Partial<Record<PresetCategoryValue, CameraPreset[]>> {
  const groups: Partial<Record<PresetCategoryValue, CameraPreset[]>> = {};
  for (const p of presets) {
    (groups[p.category] ??= []).push(p);
  }
  return groups;
}

function PresetCard({
  preset,
  active,
  onUse,
}: {
  preset: CameraPreset;
  active: boolean;
  onUse: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-[var(--color-surface)] transition-colors",
        active
          ? "border-[var(--color-primary)]"
          : "border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]",
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-muted)]">
        {preset.thumbnailUrl ? (
          <img
            src={preset.thumbnailUrl}
            alt={preset.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Clapperboard size={28} />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur">
          {preset.motionType.replace("_", " ")}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold">{preset.name}</h3>
        <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{preset.description}</p>
        {preset.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {preset.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <Button
          size="sm"
          variant={active ? "default" : "secondary"}
          onClick={onUse}
          className="mt-1 gap-1.5"
        >
          {active ? <Check size={14} /> : null}
          {active ? "In composer" : "Use"}
        </Button>
      </div>
    </div>
  );
}

export function PresetGallery() {
  const presets = usePresets();
  const setPresetId = useUIStore((s) => s.setPresetId);
  const setTab = useUIStore((s) => s.setTab);
  const activePreset = useUIStore((s) => s.presetId);

  if (presets.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const data = presets.data ?? [];
  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Clapperboard size={28} />}
        title="No presets available"
        description="Presets are seeded by the studio server — make sure it's running."
      />
    );
  }

  const groups = groupByCategory(data);
  const use = (p: CameraPreset) => {
    setPresetId(p.id);
    setTab("create");
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {CATEGORY_ORDER.filter((cat) => (groups[cat] ?? []).length > 0).map((cat) => (
        <section key={cat}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABELS[cat]}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(groups[cat] ?? []).map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                active={p.id === activePreset}
                onUse={() => use(p)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
