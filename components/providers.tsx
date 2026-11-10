"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotchToaster } from "notch-toast";
import { Suspense, useState, type ReactNode } from "react";
import { FlashToast } from "@/components/flash-toast";
import { isUnauthenticated } from "@/lib/api";
import { goToLanding } from "@/lib/navigation";

function redirectIfSignedOut(error: unknown): void {
  if (isUnauthenticated(error)) goToLanding("session-expired");
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <NotchToaster position="top-center" mode="attached" animation="gooey" />
      {/* useSearchParams needs a Suspense boundary of its own. */}
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
    </QueryClientProvider>
  );
}
