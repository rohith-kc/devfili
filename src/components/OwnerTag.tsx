import type { Step } from "@/lib/schema";
import { OWNER_LABEL } from "@/lib/format";

const OWNER_ICON: Record<Step["owner"], string> = {
  agent_did: "✓",
  agent_drafted: "✎",
  you_do: "→",
};

export function OwnerTag({ owner }: { owner: Step["owner"] }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      <span aria-hidden="true">{OWNER_ICON[owner]}</span>
      {OWNER_LABEL[owner]}
    </span>
  );
}
