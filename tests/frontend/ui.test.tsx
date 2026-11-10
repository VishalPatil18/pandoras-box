import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar } from "@/components/ui/avatar";
import { Field } from "@/components/ui/field";
import { ToastProvider, useToast } from "@/components/ui/toast";

describe("Field", () => {
  it("puts the label above the input and links help text", () => {
    render(<Field label="Favorite movie" help="Just one." name="movie" />);

    const input = screen.getByLabelText("Favorite movie");
    expect(input).toHaveAccessibleDescription("Just one.");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("links its error to the input and marks the input invalid", () => {
    render(<Field label="Favorite movie" error="Enter a movie title." name="movie" />);

    const input = screen.getByLabelText("Favorite movie");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining("Enter a movie title."));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a movie title.");
  });
});

describe("Avatar", () => {
  it("shows initials when there is no photo", () => {
    render(<Avatar src={null} name="Ada Okafor" />);

    expect(screen.getByText("AO")).toBeInTheDocument();
    expect(screen.queryByRole("img", { hidden: true, name: "" })).toBeNull();
  });

  it("falls back to initials when the photo fails to load", () => {
    const { container } = render(<Avatar src="https://example.com/broken.jpg" name="Ada Okafor" />);

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AO")).toBeInTheDocument();
  });
});

describe("Toast", () => {
  function Trigger() {
    const toast = useToast();
    return <button onClick={() => toast.show("Couldn't save.")}>save</button>;
  }

  it("announces a message and hides it after a few seconds", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't save.");

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    vi.useRealTimers();
  });
});
