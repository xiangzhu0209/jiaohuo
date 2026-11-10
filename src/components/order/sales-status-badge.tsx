import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type SalesStatus } from "@/lib/sales-types";
import { cn } from "@/lib/utils";

/** 業務單狀態標籤：草稿（灰）／待下單（金）／已下單（綠）。 */
export default function StatusBadge({ status, measure = false }: { status: SalesStatus; measure?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 whitespace-nowrap font-medium",
        status === "draft" && !measure && "border-transparent bg-muted text-muted-foreground",
        measure && "border-primary/40 bg-primary/10 text-primary",
        status === "submitted" && "border-gold/40 bg-gold/15 text-gold-text",
        status === "ordered" && "border-transparent bg-success text-success-foreground",
      )}
    >
      {measure ? "丈量單" : STATUS_LABELS[status]}
    </Badge>
  );
}
