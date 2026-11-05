import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserCheck, UserPlus, UserRoundX, Users } from "lucide-react";
import { fetchSalesMemberCandidates, fetchSalesMembers, enrollSalesMember, updateSalesMemberStatus } from "@/lib/sales-members-db";
import { type SalesMember, type SalesMemberStatus } from "@/lib/sales-types";
import SalesGuard from "@/components/order/sales-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Filter = SalesMemberStatus | "candidates";
const EMPTY_MEMBERS: SalesMember[] = [];
const EMPTY_CANDIDATES: { uid: string; email: string; name: string }[] = [];

const FILTER_LABELS: Record<Filter, string> = {
  pending: "待核准",
  active: "使用中",
  disabled: "已停用",
  candidates: "加入既有帳號",
};

function MembersInner() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [disableTarget, setDisableTarget] = useState<SalesMember | null>(null);

  const membersQuery = useQuery({
    queryKey: ["sales-members"],
    queryFn: fetchSalesMembers,
  });
  const candidatesQuery = useQuery({
    queryKey: ["sales-member-candidates"],
    queryFn: fetchSalesMemberCandidates,
    enabled: filter === "candidates",
  });
  const members = membersQuery.data ?? EMPTY_MEMBERS;
  const candidates = candidatesQuery.data ?? EMPTY_CANDIDATES;

  const counts: Record<Filter, number> = {
    pending: members.filter((m) => m.status === "pending").length,
    active: members.filter((m) => m.status === "active").length,
    disabled: members.filter((m) => m.status === "disabled").length,
    candidates: candidates.length,
  };

  const shownMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return members.filter(
      (m) => m.status === filter && (!keyword || `${m.name} ${m.email}`.toLowerCase().includes(keyword)),
    );
  }, [filter, members, search]);
  const shownCandidates = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return candidates.filter(
      (c) => !keyword || `${c.name} ${c.email}`.toLowerCase().includes(keyword),
    );
  }, [candidates, search]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["sales-members"] });
    void qc.invalidateQueries({ queryKey: ["sales-member-candidates"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ uid, status }: { uid: string; status: SalesMemberStatus }) =>
      updateSalesMemberStatus(uid, status),
    onSuccess: (_result, variables) => {
      toast(variables.status === "active" ? "業務帳號已核准／啟用" : "業務帳號已停用");
      setDisableTarget(null);
      refresh();
    },
    onError: (error) => toast(`更新失敗：${(error as Error).message}`),
  });
  const enrollMutation = useMutation({
    mutationFn: (candidate: { uid: string; email: string; name: string }) =>
      enrollSalesMember(candidate.uid, candidate.email, candidate.name),
    onSuccess: () => {
      toast("已加入待核准名單");
      refresh();
    },
    onError: (error) => toast(`加入失敗：${(error as Error).message}`),
  });

  const loading = membersQuery.isLoading || (filter === "candidates" && candidatesQuery.isLoading);
  const error = membersQuery.error || candidatesQuery.error;
  const busy = statusMutation.isPending || enrollMutation.isPending;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">業務帳號管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            核准新業務，或停用離職帳號。停用只會撤銷系統權限，不會刪除帳號或既有訂單。
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          {(["pending", "active", "disabled", "candidates"] as Filter[]).map((value) => (
            <TabsTrigger key={value} value={value} className="min-h-10 gap-1.5 px-2">
              {FILTER_LABELS[value]}
              <span className="text-xs text-muted-foreground">{counts[value]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Input
        className="h-11 text-base"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜尋姓名或 Email"
      />

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">載入中…</p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">
          讀取失敗：{(error as Error).message}
        </p>
      ) : filter === "candidates" ? (
        shownCandidates.length ? (
          <div className="flex flex-col gap-3">
            {shownCandidates.map((candidate) => (
              <Card key={candidate.uid}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Users className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{candidate.name || "未設定姓名"}</p>
                      <p className="truncate text-sm text-muted-foreground">{candidate.email}</p>
                    </div>
                  </div>
                  <Button
                    className="min-h-10 shrink-0"
                    disabled={busy}
                    onClick={() => enrollMutation.mutate(candidate)}
                  >
                    <UserPlus className="size-4" /> 加入待核准
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState>沒有可加入的既有帳號</EmptyState>
        )
      ) : shownMembers.length ? (
        <div className="flex flex-col gap-3">
          {shownMembers.map((member) => (
            <Card key={member.uid}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {filter === "active" ? (
                      <UserCheck className="size-4" />
                    ) : filter === "disabled" ? (
                      <UserRoundX className="size-4" />
                    ) : (
                      <Users className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name || "未設定姓名"}</p>
                    <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                {member.status === "pending" ? (
                  <Button
                    className="min-h-10 shrink-0"
                    disabled={busy}
                    onClick={() => statusMutation.mutate({ uid: member.uid, status: "active" })}
                  >
                    <UserCheck className="size-4" /> 核准使用
                  </Button>
                ) : member.status === "active" ? (
                  <Button
                    variant="outline"
                    className="min-h-10 shrink-0"
                    disabled={busy}
                    onClick={() => setDisableTarget(member)}
                  >
                    <UserRoundX className="size-4" /> 停用帳號
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="min-h-10 shrink-0"
                    disabled={busy}
                    onClick={() => statusMutation.mutate({ uid: member.uid, status: "active" })}
                  >
                    <UserCheck className="size-4" /> 重新啟用
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>{search ? "沒有符合的帳號" : `目前沒有${FILTER_LABELS[filter]}帳號`}</EmptyState>
      )}

      <AlertDialog open={!!disableTarget} onOpenChange={(open) => !open && setDisableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>停用這個業務帳號？</AlertDialogTitle>
            <AlertDialogDescription>
              {disableTarget?.name || disableTarget?.email} 將無法再登入使用業務介面或存取業務資料；既有訂單會保留，你仍可在管理頁查看。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (disableTarget) statusMutation.mutate({ uid: disableTarget.uid, status: "disabled" });
              }}
            >
              停用帳號
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
      <Users className="size-8 opacity-50" />
      {children}
    </div>
  );
}

export default function SalesMembers() {
  return (
    <SalesGuard adminOnly>
      <MembersInner />
    </SalesGuard>
  );
}
