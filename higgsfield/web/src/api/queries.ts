import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CharacterInput, type GenerateInput } from "./client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

export const queryKeys = {
  capabilities: ["capabilities"] as const,
  presets: ["presets"] as const,
  generations: ["generations"] as const,
  characters: ["characters"] as const,
};

/** Shared key so the feed can watch in-flight generations via useIsMutating. */
export const GENERATE_MUTATION_KEY = ["generate"] as const;

export function useCapabilities() {
  return useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: api.capabilities,
    staleTime: Infinity,
  });
}

export function usePresets() {
  return useQuery({ queryKey: queryKeys.presets, queryFn: api.presets, staleTime: Infinity });
}

export function useGenerations() {
  return useQuery({ queryKey: queryKeys.generations, queryFn: api.generations });
}

export function useCharacters() {
  return useQuery({ queryKey: queryKeys.characters, queryFn: api.characters });
}

export function useGenerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: GENERATE_MUTATION_KEY,
    mutationFn: (input: GenerateInput) => api.generate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.generations });
    },
  });
}

export function useDeleteGeneration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteGeneration(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.generations });
    },
  });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CharacterInput) => api.createCharacter(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.characters });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCharacter(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.characters });
    },
  });
}
