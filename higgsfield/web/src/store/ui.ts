import type { AspectRatioValue, Generation } from "@dasd/higg-shared";
import { create } from "zustand";

export type Tab = "create" | "presets" | "characters";

interface ComposerState {
  prompt: string;
  aspectRatio: AspectRatioValue;
  presetId: string | null;
  characterId: string | null;
  /** Reference images as data URLs, ready to POST to /api/generate. */
  references: string[];
}

interface UIState extends ComposerState {
  tab: Tab;
  setTab: (tab: Tab) => void;
  setPrompt: (prompt: string) => void;
  setAspectRatio: (aspectRatio: AspectRatioValue) => void;
  setPresetId: (presetId: string | null) => void;
  setCharacterId: (characterId: string | null) => void;
  addReferences: (urls: string[]) => void;
  removeReference: (url: string) => void;
  clearReferences: () => void;
  resetComposer: () => void;
  /** Load a past generation's prompt/preset/character back into the composer. */
  remix: (gen: Generation) => void;
}

const initialComposer: ComposerState = {
  prompt: "",
  aspectRatio: "16:9",
  presetId: null,
  characterId: null,
  references: [],
};

export const useUIStore = create<UIState>((set) => ({
  tab: "create",
  ...initialComposer,
  setTab: (tab) => set({ tab }),
  setPrompt: (prompt) => set({ prompt }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setPresetId: (presetId) => set({ presetId }),
  setCharacterId: (characterId) => set({ characterId }),
  addReferences: (urls) => set((s) => ({ references: [...s.references, ...urls] })),
  removeReference: (url) => set((s) => ({ references: s.references.filter((u) => u !== url) })),
  clearReferences: () => set({ references: [] }),
  resetComposer: () => set({ ...initialComposer }),
  remix: (gen) =>
    set({
      tab: "create",
      prompt: gen.input.prompt,
      aspectRatio: gen.input.aspectRatio,
      presetId: gen.input.presetId,
      characterId: gen.input.characterId,
      references: [],
    }),
}));
