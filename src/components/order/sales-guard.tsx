import type { ReactNode } from "react";
import { CloudOff, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { isAdminEmail } from "@/lib/sales-types";

/**
 * 業務下單頁面的共同門檻：
 * - 離線模式（資料只在這台電腦）不支援業務下單，需要連上雲端。
 * - `adminOnly` 的頁面只有管理者看得到。
 */
export default function SalesGuard({
  adminOnly,
  children,
}: {
  adminOnly?: boolean;
  children: ReactNode;
}) {
  const { user, offline } = useAuth();

  if (offline) {
    return (
      <Notice icon={<CloudOff className="size-8 text-warning" />} title="離線模式無法使用業務下單">
        業務單需要存到雲端，請先到選單按「結束離線」，連上網路後再使用。
      </Notice>
    );
  }

  if (adminOnly && !isAdminEmail(user?.email)) {
    return (
      <Notice icon={<ShieldAlert className="size-8 text-muted-foreground" />} title="只有管理者能使用這一頁">
        待下單區只開放給管理者。如果你是管理者，請確認登入的是管理者的信箱。
      </Notice>
    );
  }

  return <>{children}</>;
}

function Notice({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      {icon}
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
