import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/ui/avatar";
import { Field } from "@/components/ui/field";

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
