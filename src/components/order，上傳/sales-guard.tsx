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
  const { user, offline, salesMember, membershipLoading, businessAccount } = useAuth();

  if (offline) {
    return (
      <Notice icon={<CloudOff className="size-8 text-warning" />} title="離線模式無法使用業務下單">
        業務單需要存到雲端，請先到選單按「結束離線」，連上網路後再使用。
      </Notice>
    );
  }

  const isAdmin = isAdminEmail(user?.email);
  const isBusinessAccount = businessAccount || salesMember !== null;
  if (adminOnly && !isAdmin) {
    return (
      <Notice icon={<ShieldAlert className="size-8 text-muted-foreground" />} title="只有管理者能使用這一頁">
        這個管理頁只開放給管理者帳號。
      </Notice>
    );
  }

  if (!isAdmin && membershipLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">正在確認帳號權限…</p>;
  }

  if (!isAdmin && isBusinessAccount && salesMember?.status !== "active") {
    const title = salesMember?.status === "disabled" ? "此業務帳號已停用" : "帳號等待管理者核准";
    return (
      <Notice icon={<ShieldAlert className="size-8 text-muted-foreground" />} title={title}>
        {salesMember?.status === "disabled"
          ? "目前無法使用業務下單或讀取業務資料。如需恢復權限，請聯絡管理者。"
          : "註冊已完成；管理者核准後即可使用業務下單介面。"}
      </Notice>
    );
  }

  if (!isAdmin && !isBusinessAccount) {
    return (
      <Notice icon={<ShieldAlert className="size-8 text-muted-foreground" />} title="尚未加入業務帳號">
        請聯絡管理者將此帳號加入業務名單並核准。
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
