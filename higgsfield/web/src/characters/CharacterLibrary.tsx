import type { Character } from "@dasd/higg-shared";
import { Button, cn } from "@dasd/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Film, ImagePlus, Plus, Trash2, User, X } from "lucide-react";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  useCapabilities,
  useCharacters,
  useCreateCharacter,
  useDeleteCharacter,
} from "../api/queries";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { filesToDataUrls } from "../lib/files";
import { useUIStore } from "../store/ui";

const characterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
type CharacterForm = z.infer<typeof characterSchema>;

function CharacterCard({
  character,
  onUse,
  onAnimate,
  animateReady,
  onDelete,
}: {
  character: Character;
  onUse: () => void;
  onAnimate: () => void;
  animateReady: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-surface-2)]">
        {character.coverUrl ? (
          <img
            src={character.coverUrl}
            alt={character.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <User size={32} />
          </div>
        )}
        <button
          type="button"
          onClick={onDelete}
          title="Delete character"
          className="absolute right-2 top-2 rounded-md bg-black/50 p-1.5 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/70 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold">{character.name}</h3>
        {character.description ? (
          <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">
            {character.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onUse} className="flex-1">
            Use in composer
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onAnimate}
            disabled={!animateReady}
            title="Animate — video from this character"
            className="flex-1 gap-1.5"
          >
            <Film size={13} />
            Animate
          </Button>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Animate uses the character's reference image as the video's first frame.
        </p>
      </div>
    </div>
  );
}

export function CharacterLibrary() {
  const characters = useCharacters();
  const caps = useCapabilities();
  const create = useCreateCharacter();
  const del = useDeleteCharacter();
  const setCharacterId = useUIStore((s) => s.setCharacterId);
  const setTab = useUIStore((s) => s.setTab);
  const animateCharacter = useUIStore((s) => s.animateCharacter);
  const [refs, setRefs] = useState<string[]>([]);

  const { register, handleSubmit, reset, formState } = useForm<CharacterForm>({
    resolver: zodResolver(characterSchema),
    defaultValues: { name: "", description: "" },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted: File[]) => {
      void filesToDataUrls(accepted).then((urls) => setRefs((prev) => [...prev, ...urls]));
    },
    accept: { "image/*": [] },
  });

  const submit = handleSubmit((values) => {
    create.mutate(
      { name: values.name, description: values.description, references: refs },
      {
        onSuccess: () => {
          reset();
          setRefs([]);
        },
      },
    );
  });

  const use = (c: Character) => {
    setCharacterId(c.id);
    setTab("create");
  };

  const list = characters.data ?? [];

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
      <form
        onSubmit={submit}
        className="flex h-fit flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <h2 className="text-sm font-semibold">New character</h2>
        <div>
          <input
            {...register("name")}
            placeholder="Name"
            className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]"
          />
          {formState.errors.name ? (
            <p className="mt-1 text-xs text-[var(--color-destructive)]">
              {formState.errors.name.message}
            </p>
          ) : null}
        </div>
        <textarea
          {...register("description")}
          placeholder="Description (optional)"
          rows={3}
          className="w-full resize-none rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]"
        />

        <div
          {...getRootProps({
            className: cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground transition-colors",
              isDragActive
                ? "border-[var(--color-ring)]"
                : "border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]",
            ),
          })}
        >
          <input {...getInputProps()} />
          <ImagePlus size={20} />
          <span>Drop reference images or click</span>
        </div>

        {refs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {refs.map((url, i) => (
              <div
                key={url}
                className="group relative h-14 w-14 overflow-hidden rounded-lg border border-[var(--color-border)]"
              >
                <img src={url} alt={`ref ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setRefs((prev) => prev.filter((u) => u !== url))}
                  aria-label="Remove"
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <Button type="submit" disabled={create.isPending} className="gap-2">
          {create.isPending ? <Spinner className="h-4 w-4" /> : <Plus size={16} />}
          Create character
        </Button>
        {create.isError ? (
          <p className="text-xs text-[var(--color-destructive)]">
            {create.error?.message ?? "Failed to create character"}
          </p>
        ) : null}
      </form>

      <div>
        {characters.isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Spinner className="h-6 w-6" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<User size={28} />}
            title="No characters yet"
            description="Create a reusable identity on the left to keep a consistent cast across generations."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                onUse={() => use(c)}
                onAnimate={() => animateCharacter(c.id)}
                animateReady={Boolean(caps.data)}
                onDelete={() => del.mutate(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
