import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "notch-toast";
import { describe, expect, it, vi } from "vitest";
import { fakeBackend, renderDashboard } from "./dashboard-helpers";

vi.mock("@/lib/navigation", () => ({ goToLanding: vi.fn() }));

async function editTo(title: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const input = screen.getByLabelText("Favorite movie");
  await user.clear(input);
  if (title) await user.type(input, title);
  await user.click(screen.getByRole("button", { name: "Save" }));
}

const heading = () => screen.getByRole("heading", { level: 1 });

describe("inline movie edit", () => {
  it("shows the new title the moment Save is pressed", async () => {
    const backend = fakeBackend({ saveDelayMs: 200 });
    renderDashboard();
    await screen.findByText("Inception: a fact.");

    await editTo("Heat");

    expect(heading()).toHaveTextContent("Heat");
    expect(backend.movie).toBe("Inception");
    expect(screen.getByText("Saving")).toBeInTheDocument();
  });

  it("puts the old title back and explains when the save fails", async () => {
    fakeBackend({ saveFails: true });
    renderDashboard();
    await screen.findByText("Inception: a fact.");

    await editTo("Heat");

    await waitFor(() => expect(heading()).toHaveTextContent("Inception"));
    expect(toast.error).toHaveBeenCalledWith(
      'Couldn\'t save "Heat". Your favorite is still Inception.',
      { duration: 5_000 },
    );
  });

  it("restores the view and returns focus to Edit on Cancel", async () => {
    fakeBackend();
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Favorite movie"), " Returns");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(heading()).toHaveTextContent("Inception");
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
  });

  it("shows the rule and sends nothing for an empty title", async () => {
    const backend = fakeBackend();
    renderDashboard();

    await editTo("");

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a movie title.");
    expect(backend.saveRequests).toBe(0);
  });
});
