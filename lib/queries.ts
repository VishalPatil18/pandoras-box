"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Me } from "@/lib/contracts";
import { movieKey } from "@/lib/movie";

export const CLIENT_CACHE_MS = 30_000;

export const queryKeys = {
  me: ["me"] as const,
  facts: ["fact"] as const,
  fact: (key: string) => ["fact", key] as const,
};

export const setMovieMutationKey = ["setMovie"] as const;

export function useMe(initialMe: Me) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: api.getMe,
    initialData: initialMe,
    staleTime: CLIENT_CACHE_MS,
  });
}

// Callers pause this while a movie save is in flight, so the old movie's fact never lands under the new key.
export function useFact(key: string, options: { enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.fact(key),
    queryFn: api.getFact,
    staleTime: CLIENT_CACHE_MS,
    retry: false,
    enabled: options.enabled,
  });
}

export function useSetMovie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: setMovieMutationKey,
    mutationFn: (movie: string) => api.setMovie(movie),
    onMutate: async (movie) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.me });
      const previous = queryClient.getQueryData<Me>(queryKeys.me);
      if (previous)
        queryClient.setQueryData<Me>(queryKeys.me, { ...previous, favoriteMovie: movie });
      return { previous };
    },
    onError: (_error, _movie, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.me, context.previous);
    },
    onSuccess: async ({ favoriteMovie }, _movie, context) => {
      queryClient.setQueryData<Me>(queryKeys.me, (current) =>
        current ? { ...current, favoriteMovie } : current,
      );
      const before = context?.previous?.favoriteMovie;
      // A capitalization-only edit keeps the same key, so the cached fact still applies.
      if (before && movieKey(before) === movieKey(favoriteMovie)) return;
      // Mark facts stale without refetching; the new movie's query fetches on its own.
      await queryClient.invalidateQueries({ queryKey: queryKeys.facts, refetchType: "none" });
    },
  });
}
