import { Avatar } from "@/components/ui/avatar";
import type { Me } from "@/lib/contracts";
import { displayName } from "@/lib/display";

export function ProfilePill({ me }: { me: Me }) {
  const name = displayName(me);

  return (
    <div className="flex items-center gap-2.5 rounded-pill border border-carbon bg-paper py-2 pr-5 pl-2">
      <Avatar src={me.image} name={name} />
      <span className="grid leading-tight">
        <span className="text-sm font-bold">{name}</span>
        <span className="hidden text-xs text-ink-soft sm:block">{me.email}</span>
      </span>
    </div>
  );
}
