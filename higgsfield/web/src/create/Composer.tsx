import { Button, cn } from "@dasd/ui";
import { Clapperboard, ImagePlus, Sparkles, User, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useCharacters, useGenerate, usePresets } from "../api/queries";
import { Chip } from "../components/Chip";
import { SegmentedControl } from "../components/SegmentedControl";
import { Spinner } from "../components/Spinner";
import { ASPECT_RATIOS } from "../lib/aspect";
import { filesToDataUrls } from "../lib/files";
import { useUIStore } from "../store/ui";

function Picker({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} aria-hidden />
      <div className="absolute left-0 top-full z-30 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1 shadow-2xl">
        {children}
      </div>
    </>
  );
}

function PickerItem({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition-colors",
        active
          ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
          : "hover:bg-[var(--color-muted)]",
      )}
    >
      {children}
    </button>
  );
}

export function Composer() {
  const prompt = useUIStore((s) => s.prompt);
  const setPrompt = useUIStore((s) => s.setPrompt);
  const aspectRatio = useUIStore((s) => s.aspectRatio);
  const setAspectRatio = useUIStore((s) => s.setAspectRatio);
  const presetId = useUIStore((s) => s.presetId);
  const setPresetId = useUIStore((s) => s.setPresetId);
  const characterId = useUIStore((s) => s.characterId);
  const setCharacterId = useUIStore((s) => s.setCharacterId);
  const references = useUIStore((s) => s.references);
  const addReferences = useUIStore((s) => s.addReferences);
  const removeReference = useUIStore((s) => s.removeReference);

  const presets = usePresets();
  const characters = useCharacters();
  const generate = useGenerate();

  const [presetOpen, setPresetOpen] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);

  const selectedPreset = presets.data?.find((p) => p.id === presetId) ?? null;
  const selectedCharacter = characters.data?.find((c) => c.id === characterId) ?? null;

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (accepted: File[]) => {
      void filesToDataUrls(accepted).then(addReferences);
    },
    accept: { "image/*": [] },
    noClick: true,
    noKeyboard: true,
  });

  const canGenerate = prompt.trim().length > 0 && !generate.isPending;

  const submit = () => {
    if (!canGenerate) return;
    generate.mutate({ prompt: prompt.trim(), aspectRatio, presetId, characterId, references });
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5">
      <div
        {...getRootProps({
          className: cn("relative rounded-xl", isDragActive && "ring-2 ring-[var(--color-ring)]"),
        })}
      >
        <input {...getInputProps()} />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={3}
          placeholder="Describe your shot — a neon-lit alley at night, cinematic, 35mm, volumetric fog…"
          className="w-full resize-none rounded-xl border border-[var(--color-input)] bg-[var(--color-background)] p-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--color-ring)]"
        />
        {isDragActive ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-[var(--color-background)] text-sm text-[var(--color-accent)]">
            Drop reference images…
          </div>
        ) : null}
      </div>

      {references.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {references.map((url, i) => (
            <div
              key={url}
              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--color-border)]"
            >
              <img src={url} alt={`reference ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeReference(url)}
                aria-label="Remove reference"
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Chip
            active={Boolean(selectedPreset)}
            icon={<Clapperboard size={14} />}
            onClick={() => {
              setPresetOpen((v) => !v);
              setCharacterOpen(false);
            }}
          >
            {selectedPreset ? selectedPreset.name : "Preset"}
          </Chip>
          {presetOpen ? (
            <Picker onClose={() => setPresetOpen(false)}>
              <PickerItem
                active={presetId === null}
                onClick={() => {
                  setPresetId(null);
                  setPresetOpen(false);
                }}
              >
                No preset
              </PickerItem>
              {(presets.data ?? []).map((p) => (
                <PickerItem
                  key={p.id}
                  active={p.id === presetId}
                  onClick={() => {
                    setPresetId(p.id);
                    setPresetOpen(false);
                  }}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 opacity-70">{p.motionType.replace("_", " ")}</span>
                </PickerItem>
              ))}
            </Picker>
          ) : null}
        </div>

        <div className="relative">
          <Chip
            active={Boolean(selectedCharacter)}
            icon={<User size={14} />}
            onClick={() => {
              setCharacterOpen((v) => !v);
              setPresetOpen(false);
            }}
          >
            {selectedCharacter ? selectedCharacter.name : "Character"}
          </Chip>
          {characterOpen ? (
            <Picker onClose={() => setCharacterOpen(false)}>
              <PickerItem
                active={characterId === null}
                onClick={() => {
                  setCharacterId(null);
                  setCharacterOpen(false);
                }}
              >
                No character
              </PickerItem>
              {(characters.data ?? []).map((c) => (
                <PickerItem
                  key={c.id}
                  active={c.id === characterId}
                  onClick={() => {
                    setCharacterId(c.id);
                    setCharacterOpen(false);
                  }}
                >
                  {c.name}
                </PickerItem>
              ))}
              {(characters.data ?? []).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No characters yet</div>
              ) : null}
            </Picker>
          ) : null}
        </div>

        <Chip icon={<ImagePlus size={14} />} onClick={open}>
          Reference
        </Chip>

        <div className="ml-auto">
          <SegmentedControl
            value={aspectRatio}
            onChange={setAspectRatio}
            options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs">
          {generate.isError ? (
            <span className="text-[var(--color-destructive)]">
              {generate.error?.message ?? "Generation failed"}
            </span>
          ) : (
            <span className="text-muted-foreground">⌘/Ctrl + Enter to generate</span>
          )}
        </p>
        <Button size="lg" onClick={submit} disabled={!canGenerate} className="gap-2">
          {generate.isPending ? <Spinner className="h-4 w-4" /> : <Sparkles size={16} />}
          {generate.isPending ? "Generating…" : "Generate"}
        </Button>
      </div>
    </div>
  );
}
