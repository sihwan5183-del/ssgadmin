import { AlertTriangle } from "lucide-react";

interface Props {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export const EmptyHint = ({ message, actionLabel, actionHref }: Props) => (
  <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-warning">
    <AlertTriangle className="size-4 shrink-0" />
    <span className="flex-1">{message}</span>
    {actionLabel && actionHref && (
      <a
        href={actionHref}
        className="rounded-md border border-warning/40 px-2 py-1 text-[11px] font-medium hover:bg-warning/10"
      >
        {actionLabel}
      </a>
    )}
  </div>
);
