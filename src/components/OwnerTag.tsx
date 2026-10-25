import type { Step } from "@/lib/schema";
import { OWNER_LABEL } from "@/lib/format";

const OWNER_ICON: Record<Step["owner"], string> = {
  agent_did: "✓",
  agent_drafted: "✎",
  you_do: "→",
};

export function OwnerTag({ owner }: { owner: Step["owner"] }) {
  return (
    <span className="font-mono-label inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium uppercase text-muted">
      <span aria-hidden="true">{OWNER_ICON[owner]}</span>
      {OWNER_LABEL[owner]}
    </span>
  );
}
