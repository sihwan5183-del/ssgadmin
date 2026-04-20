import { AlertTriangle } from "lucide-react";

interface Props {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export const EmptyHint = ({ message, actionLabel, actionHref }: Props) => (
  <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200">
    <AlertTriangle className="size-4 shrink-0 text-amber-400" />
    <span className="flex-1">{message}</span>
    {actionLabel && actionHref && (
      <a
        href={actionHref}
        className="rounded-md border border-amber-400/40 px-2 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/10"
      >
        {actionLabel}
      </a>
    )}
  </div>
);
