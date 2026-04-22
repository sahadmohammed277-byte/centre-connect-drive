import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export function DataTableShell({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  actions,
  filters,
  children,
  isEmpty,
  emptyMessage = "No data to show",
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
          {filters}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        {isEmpty ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
