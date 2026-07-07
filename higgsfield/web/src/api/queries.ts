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

/** How often the feed re-reads while any job is queued/running. The server
 *  advances async video jobs lazily on each read, so polling = refetching. */
const ACTIVE_POLL_MS = 2_000;

export function useGenerations() {
  return useQuery({
    queryKey: queryKeys.generations,
    queryFn: api.generations,
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (g) => g.status === "queued" || g.status === "running",
      );
      return hasActive ? ACTIVE_POLL_MS : false;
    },
  });
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
