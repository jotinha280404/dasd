import type { AspectRatioValue, Generation, MediaKindValue } from "@dasd/higg-shared";
import { create } from "zustand";

export type Tab = "create" | "presets" | "characters";

interface ComposerState {
  /** What the composer will generate: a still frame or a video job. */
  mode: MediaKindValue;
  prompt: string;
  aspectRatio: AspectRatioValue;
  presetId: string | null;
  characterId: string | null;
  /** Reference images as data URLs, ready to POST to /api/generate. */
  references: string[];
  /** Video mode: output asset of a previous image generation to animate from. */
  initAssetId: string | null;
  /** Preview URL for the init asset (shown as a thumbnail in the composer). */
  initPreviewUrl: string | null;
  /** Video mode: clip length in seconds. */
  durationSec: number;
}

interface UIState extends ComposerState {
  tab: Tab;
  /** Incremented whenever another surface prefills the composer and wants it
   *  scrolled into view + focused; the composer consumes it back to 0. */
  composerFocusRequest: number;
  setTab: (tab: Tab) => void;
  setMode: (mode: MediaKindValue) => void;
  setPrompt: (prompt: string) => void;
  setAspectRatio: (aspectRatio: AspectRatioValue) => void;
  setPresetId: (presetId: string | null) => void;
  setCharacterId: (characterId: string | null) => void;
  setDurationSec: (durationSec: number) => void;
  clearInitImage: () => void;
  addReferences: (urls: string[]) => void;
  removeReference: (url: string) => void;
  clearReferences: () => void;
  resetComposer: () => void;
  consumeComposerFocus: () => void;
  /** Load a past generation's prompt/preset/character back into the composer. */
  remix: (gen: Generation) => void;
  /** Feed "Animate": video mode seeded with an image generation's first output
   *  as the init frame, carrying over its prompt and preset. */
  animateGeneration: (gen: Generation) => void;
  /** Character "Animate": video mode with the character set — the server
   *  resolves the character's reference image as the init frame. */
  animateCharacter: (characterId: string) => void;
}

const initialComposer: ComposerState = {
  mode: "image",
  prompt: "",
  aspectRatio: "16:9",
  presetId: null,
  characterId: null,
  references: [],
  initAssetId: null,
  initPreviewUrl: null,
  durationSec: 5,
};

export const useUIStore = create<UIState>((set) => ({
  tab: "create",
  composerFocusRequest: 0,
  ...initialComposer,
  setTab: (tab) => set({ tab }),
  setMode: (mode) => set({ mode }),
  setPrompt: (prompt) => set({ prompt }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setPresetId: (presetId) => set({ presetId }),
  setCharacterId: (characterId) => set({ characterId }),
  setDurationSec: (durationSec) => set({ durationSec }),
  clearInitImage: () => set({ initAssetId: null, initPreviewUrl: null }),
  addReferences: (urls) => set((s) => ({ references: [...s.references, ...urls] })),
  removeReference: (url) => set((s) => ({ references: s.references.filter((u) => u !== url) })),
  clearReferences: () => set({ references: [] }),
  resetComposer: () => set({ ...initialComposer }),
  consumeComposerFocus: () => set({ composerFocusRequest: 0 }),
  remix: (gen) =>
    set((s) => ({
      tab: "create",
      mode: gen.kind,
      prompt: gen.input.prompt,
      aspectRatio: gen.input.aspectRatio,
      presetId: gen.input.presetId,
      characterId: gen.input.characterId,
      references: [],
      initAssetId: null,
      initPreviewUrl: null,
      durationSec: gen.input.durationSec ?? s.durationSec,
    })),
  animateGeneration: (gen) => {
    const output = gen.outputs[0];
    set((s) => ({
      tab: "create",
      mode: "video",
      prompt: gen.input.prompt,
      presetId: gen.input.presetId,
      // The init frame drives identity here; a character would double-condition.
      characterId: null,
      initAssetId: output ? output.assetId : null,
      initPreviewUrl: output ? output.url : null,
      composerFocusRequest: s.composerFocusRequest + 1,
    }));
  },
  animateCharacter: (characterId) =>
    set((s) => ({
      tab: "create",
      mode: "video",
      characterId,
      // The server uses the character's reference image as the init frame.
      initAssetId: null,
      initPreviewUrl: null,
      composerFocusRequest: s.composerFocusRequest + 1,
    })),
}));
