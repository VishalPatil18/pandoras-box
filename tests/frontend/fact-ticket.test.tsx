import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { NewFactButton } from "@/components/dashboard/new-fact-button";
import { server } from "../setup/frontend";
import { factFor, fakeBackend, renderDashboard } from "./dashboard-helpers";

vi.mock("@/lib/navigation", () => ({ goToLanding: vi.fn() }));

async function editTo(title: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const input = screen.getByLabelText("Favorite movie");
  await user.clear(input);
  await user.type(input, title);
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("fact ticket", () => {
  it("loads the fact for the new movie after a successful save", async () => {
    const backend = fakeBackend();
    renderDashboard();
    await screen.findByText("Inception: a fact.");

    await editTo("Heat");

    expect(await screen.findByText("Heat: a fact.")).toBeInTheDocument();
    expect(backend.factRequests).toBe(2);
  });

  it("keeps the current fact after a capitalization-only edit", async () => {
    const backend = fakeBackend();
    renderDashboard();
    await screen.findByText("Inception: a fact.");

    await editTo("INCEPTION");

    await waitFor(() => expect(backend.saveRequests).toBe(1));
    expect(screen.getByText("Inception: a fact.")).toBeInTheDocument();
    expect(backend.factRequests).toBe(1);
  });

  it("marks a fallback fact as possibly stale", async () => {
    server.use(
      http.get("*/api/fact", () =>
        HttpResponse.json(factFor("Inception", { source: "fallback", secondsUntilRefresh: 0 })),
      ),
    );
    renderDashboard();

    expect(
      await screen.findByText("Couldn't get a fresh fact, so here's your last one."),
    ).toBeInTheDocument();
  });

  it("offers Try again and hides New fact when no fact is available", async () => {
    server.use(
      http.get("*/api/fact", () =>
        HttpResponse.json(
          {
            error: {
              code: "FACT_UNAVAILABLE",
              message: "Couldn't load a fact. OpenAI didn't answer in time.",
            },
          },
          { status: 503 },
        ),
      ),
    );
    renderDashboard();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(
      screen.getByText("Couldn't load a fact. OpenAI didn't answer in time."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New fact/ })).toBeNull();
  });
});

describe("New fact button", () => {
  it("counts down from the server's seconds and unlocks at zero", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(
      <NewFactButton
        secondsUntilRefresh={3}
        receivedAt={Date.now()}
        fetching={false}
        onClick={onClick}
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("New fact in 3s");
    expect(button).toBeDisabled();

    act(() => vi.advanceTimersByTime(3_000));

    expect(button).toHaveTextContent("New fact");
    expect(button).not.toHaveTextContent("in");
    expect(button).toBeEnabled();
    vi.useRealTimers();
  });

  it("is disabled while a fact is loading", () => {
    render(
      <NewFactButton secondsUntilRefresh={0} receivedAt={Date.now()} fetching onClick={vi.fn()} />,
    );

    expect(screen.getByRole("button")).toHaveTextContent("Getting a fact");
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
