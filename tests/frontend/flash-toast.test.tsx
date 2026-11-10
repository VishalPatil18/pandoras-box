import { render } from "@testing-library/react";
import { toast } from "notch-toast";
import { describe, expect, it, vi } from "vitest";
import { FlashToast } from "@/components/flash-toast";

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: { replace: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => "/dashboard",
  useSearchParams: () => navigation.params,
}));

describe("FlashToast", () => {
  it("shows the toast named in ?toast= and strips the flag from the URL", () => {
    navigation.params = new URLSearchParams("toast=signed-in&tab=fact");

    render(<FlashToast />);

    expect(toast.success).toHaveBeenCalledWith("You're signed in.", { duration: 5_000 });
    expect(navigation.router.replace).toHaveBeenCalledWith("/dashboard?tab=fact", {
      scroll: false,
    });
  });

  it("ignores unknown keys so a crafted URL can't show arbitrary text", () => {
    navigation.params = new URLSearchParams("toast=hello");

    render(<FlashToast />);

    expect(toast).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });
});
