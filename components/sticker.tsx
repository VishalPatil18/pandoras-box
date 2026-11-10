import { cn } from "cn";
import { Icon, type IconName } from "@/components/icons";

const STICKER_COLORS = {
  ember: "bg-ember text-carbon",
  sun: "bg-sun text-carbon",
  violet: "bg-violet text-paper",
  lavender: "bg-lavender text-carbon",
  mint: "bg-mint text-carbon",
} as const;

export type StickerColor = keyof typeof STICKER_COLORS;

// Decorative only: flat fill, black outline, slight tilt. Screen readers skip it.
export function Sticker({
  icon,
  color,
  rotate = 0,
  className,
}: {
  icon: IconName;
  color: StickerColor;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ rotate: `${rotate}deg` }}
      className={cn(
        "grid aspect-square w-[clamp(56px,7vw,92px)] place-items-center rounded-card border border-carbon [&_svg]:size-[46%]",
        STICKER_COLORS[color],
        className,
      )}
    >
      <Icon name={icon} />
    </span>
  );
}
