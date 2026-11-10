"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { isUnauthenticated } from "@/lib/api";
import { goToLanding } from "@/lib/navigation";

function redirectIfSignedOut(error: unknown): void {
  if (isUnauthenticated(error)) goToLanding();
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser tab; useState keeps it stable across renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: redirectIfSignedOut }),
        mutationCache: new MutationCache({ onError: redirectIfSignedOut }),
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
