"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { FLASH_MESSAGES, isFlashKey } from "@/lib/notify";

// Shows the toast named in ?toast=, then drops the flag so a reload doesn't repeat it.
export function FlashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const key = params.get("toast");

  useEffect(() => {
    if (!isFlashKey(key)) return;
    FLASH_MESSAGES[key]();
    const rest = new URLSearchParams(params);
    rest.delete("toast");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [key, params, pathname, router]);

  return null;
}
