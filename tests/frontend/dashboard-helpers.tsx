import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Providers } from "@/components/providers";
import type { FactResponse, Me } from "@/lib/contracts";
import { server } from "../setup/frontend";

export const ADA: Me = {
  id: "user-ada",
  name: "Ada Okafor",
  email: "ada@example.com",
  image: null,
  favoriteMovie: "Inception",
};

export function factFor(movieTitle: string, overrides: Partial<FactResponse> = {}): FactResponse {
  return {
    fact: {
      text: `${movieTitle}: a fact.`,
      movieTitle,
      generatedAt: new Date().toISOString(),
    },
    source: "generated",
    secondsUntilRefresh: 60,
    ...overrides,
  };
}

// Serves facts for whichever movie the fake server currently has saved.
export function fakeBackend(options: { saveFails?: boolean; saveDelayMs?: number } = {}) {
  const state = { movie: ADA.favoriteMovie ?? "", factRequests: 0, saveRequests: 0 };
  server.use(
    http.get("*/api/fact", () => {
      state.factRequests += 1;
      return HttpResponse.json(factFor(state.movie));
    }),
    http.put("*/api/me/movie", async ({ request }) => {
      state.saveRequests += 1;
      const { movie } = (await request.json()) as { movie: string };
      if (options.saveDelayMs) await new Promise((r) => setTimeout(r, options.saveDelayMs));
      if (options.saveFails) {
        return HttpResponse.json(
          { error: { code: "INTERNAL", message: "Something went wrong." } },
          { status: 500 },
        );
      }
      state.movie = movie;
      return HttpResponse.json({ favoriteMovie: movie });
    }),
  );
  return state;
}

export function renderDashboard(me: Me = ADA) {
  return render(
    <Providers>
      <Dashboard initialMe={me} />
    </Providers>,
  );
}
