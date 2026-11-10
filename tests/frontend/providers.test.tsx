import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { goToLanding } from "@/lib/navigation";
import { useFact } from "@/lib/queries";
import { server } from "../setup/frontend";

vi.mock("@/lib/navigation", () => ({ goToLanding: vi.fn() }));

const FACT = {
  fact: {
    text: "Inception (2010): a fact.",
    movieTitle: "Inception",
    generatedAt: new Date().toISOString(),
  },
  source: "cache",
  secondsUntilRefresh: 40,
};

function FactProbe() {
  const fact = useFact("inception", { enabled: true });
  return <p>{fact.data?.fact.text ?? fact.status}</p>;
}

function Toggle() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button onClick={() => setShown((value) => !value)}>toggle</button>
      {shown && <FactProbe />}
    </>
  );
}

describe("Providers", () => {
  it("sends the user to the landing page when any request comes back 401", async () => {
    server.use(
      http.get("*/api/fact", () =>
        HttpResponse.json(
          { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
          { status: 401 },
        ),
      ),
    );

    render(
      <Providers>
        <FactProbe />
      </Providers>,
    );

    await waitFor(() => expect(goToLanding).toHaveBeenCalled());
  });

  it("reuses a fact fetched under 30 seconds ago instead of asking again", async () => {
    let requests = 0;
    server.use(
      http.get("*/api/fact", () => {
        requests += 1;
        return HttpResponse.json(FACT);
      }),
    );

    render(
      <Providers>
        <Toggle />
      </Providers>,
    );
    await screen.findByText("Inception (2010): a fact.");

    screen.getByRole("button", { name: "toggle" }).click();
    screen.getByRole("button", { name: "toggle" }).click();

    expect(await screen.findByText("Inception (2010): a fact.")).toBeInTheDocument();
    expect(requests).toBe(1);
  });
});
