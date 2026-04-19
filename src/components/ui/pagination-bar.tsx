import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export const PaginationBar = ({ page, pageSize, total, onChange }: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm">
      <div className="text-muted-foreground tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} / 총 <span className="font-semibold text-foreground">{total.toLocaleString()}</span>건
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="h-8 px-2"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs tabular-nums px-2">
          <span className="font-semibold text-foreground">{page + 1}</span>
          <span className="text-muted-foreground"> / {totalPages}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= totalPages}
          onClick={() => onChange(page + 1)}
          className="h-8 px-2"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
};
