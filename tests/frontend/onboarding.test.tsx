import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding-form";
import { displayName } from "@/lib/display";
import { server } from "../setup/frontend";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("displayName", () => {
  it("uses the Google name when there is one", () => {
    expect(displayName({ name: "Ada Okafor", email: "ada@example.com" })).toBe("Ada Okafor");
  });

  it("falls back to the part of the email before the @", () => {
    expect(displayName({ name: null, email: "ada.okafor@example.com" })).toBe("ada.okafor");
  });
});

describe("OnboardingForm", () => {
  beforeEach(() => router.replace.mockReset());

  async function submit(title: string) {
    const user = userEvent.setup();
    render(<OnboardingForm />);
    if (title) await user.type(screen.getByLabelText("Favorite movie"), title);
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
  }

  it("saves the movie and goes to the dashboard", async () => {
    server.use(http.put("*/api/me/movie", () => HttpResponse.json({ favoriteMovie: "Heat" })));

    await submit("Heat");

    await vi.waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/dashboard?toast=onboarded"),
    );
  });

  it("stops an empty title before sending anything", async () => {
    await submit("");

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a movie title.");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows the server's validation message and stays on the page", async () => {
    server.use(
      http.put("*/api/me/movie", () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Keep the title under 100 characters.",
              issues: [{ path: ["movie"], message: "Keep the title under 100 characters." }],
            },
          },
          { status: 400 },
        ),
      ),
    );

    await submit("Heat");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Keep the title under 100 characters.",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("disables the button while saving", async () => {
    server.use(
      http.put("*/api/me/movie", async () => {
        await delay(200);
        return HttpResponse.json({ favoriteMovie: "Heat" });
      }),
    );

    await submit("Heat");

    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
  });
});
