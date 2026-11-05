import { Navigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function SalesPending() {
  const { salesMember, membershipLoading, signOut, businessAccount } = useAuth();
  if (membershipLoading) return <p className="py-16 text-center text-sm text-muted-foreground">正在確認帳號權限…</p>;
  if (!businessAccount) return <Navigate to="/sales/new" replace />;
  if (salesMember?.status === "active") return <Navigate to="/sales/new" replace />;

  const disabled = salesMember?.status === "disabled";
  return (
    <div className="flex min-h-[65vh] items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-7 text-center shadow-elegant sm:p-9">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="text-xl font-semibold">{disabled ? "業務帳號已停用" : "等待管理者核准"}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {disabled
            ? "此帳號目前無法進入業務下單或讀取業務資料。若需恢復使用，請聯絡管理者。"
            : "註冊已完成。管理者核准後即可開始使用業務下單；核准前無法查看或操作訂單。"}
        </p>
        <Button variant="outline" className="mt-2 min-h-11" onClick={() => void signOut()}>
          <LogOut className="size-4" /> 登出
        </Button>
      </div>
    </div>
  );
}
