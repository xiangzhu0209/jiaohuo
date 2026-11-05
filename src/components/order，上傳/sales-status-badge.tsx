import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type SalesStatus } from "@/lib/sales-types";
import { cn } from "@/lib/utils";

/** 業務單狀態標籤：草稿（灰）／待下單（金）／已下單（綠）。 */
export default function StatusBadge({ status }: { status: SalesStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 whitespace-nowrap font-medium",
        status === "draft" && "border-transparent bg-muted text-muted-foreground",
        status === "submitted" && "border-gold/40 bg-gold/15 text-gold-text",
        status === "ordered" && "border-transparent bg-success text-success-foreground",
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
