import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileCheck2, Plus, Printer, Save, Send } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createSalesOrder, fetchSalesOrder, updateSalesOrder } from "@/lib/sales-db";
import {
  KIND_LABELS,
  PAY_LABELS,
  SHAPE_SIDE_LABELS,
  balanceOf,
  digitsOnly,
  isAdminEmail,
  isBlankWindow,
  newWindow,
  newWindowId,
  windowLabels,
  todayISO,
  type PayMethod,
  type SalesKind,
  type SalesOrderInput,
  type SalesStatus,
  type SalesWindow,
} from "@/lib/sales-types";
import { fmtMoney, toNum } from "@/lib/order-utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import SalesGuard from "@/components/order/sales-guard";
import WindowCard, { Choice, Field } from "@/components/order/sales-window-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const PAY_OPTIONS = (Object.keys(PAY_LABELS) as Exclude<PayMethod, "">[]).map((value) => ({
  value,
  label: PAY_LABELS[value],
}));

interface SaveArgs {
  target: SalesStatus;
  /** 不指定就沿用目前的模式（丈量單／一般業務單） */
  measureOnly?: boolean;
  /** 存完之後：default 照原本流程、print 到列印頁、stay 留在原頁 */
  after?: "default" | "print" | "stay";
}

function SalesFormInner() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const { user, profileName, businessAccount, salesMember } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const businessMode = (businessAccount || salesMember !== null) && !isAdmin;

  const [person, setPerson] = useState("");
  const [kind, setKind] = useState<SalesKind>("company");
  const [orderDate, setOrderDate] = useState(todayISO());
  const [installTime, setInstallTime] = useState("");
  const [scheduledInstallTime, setScheduledInstallTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [totalText, setTotalText] = useState("");
  const [depositText, setDepositText] = useState("");
  const [depositMethod, setDepositMethod] = useState<PayMethod>("");
  const [balanceMethod, setBalanceMethod] = useState<PayMethod>("");
  const [notes, setNotes] = useState("");
  const [windows, setWindows] = useState<SalesWindow[]>(() => [newWindow()]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const personTouched = useRef(false);
  const hydrated = useRef(false);

  const { data: existing, isLoading, isError } = useQuery({
    queryKey: ["sales-order", id],
    enabled: isEdit,
    queryFn: () => fetchSalesOrder(id!),
  });

  // 只重新讀取權限狀態，不覆寫已輸入的表單；管理者核准或鎖定時即時刷新。
  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, "sales_orders", id), () => {
      void qc.invalidateQueries({ queryKey: ["sales-order", id] });
    });
  }, [id, qc]);

  // 新單：第一個窗位預設展開
  useEffect(() => {
    if (!isEdit) setOpenIds(new Set([windows[0].id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 新單：負責人預設帶登入者姓名（使用者自己改過就不再覆蓋）
  useEffect(() => {
    if (!isEdit && !personTouched.current && profileName) setPerson(profileName);
  }, [isEdit, profileName]);

  // 編輯：把雲端的資料放進表單（只放一次）
  useEffect(() => {
    if (!existing || hydrated.current) return;
    hydrated.current = true;
    setPerson(existing.person);
    setKind(existing.kind);
    setOrderDate(existing.orderDate || todayISO());
    setInstallTime(existing.installTime);
    setScheduledInstallTime(existing.scheduledInstallTime);
    setCustomerName(existing.customerName);
    setPhone(existing.phone);
    setAddress(existing.address);
    setTotalText(existing.total ? String(existing.total) : "");
    setDepositText(existing.deposit ? String(existing.deposit) : "");
    setDepositMethod(existing.depositMethod);
    setBalanceMethod(existing.balanceMethod);
    setNotes(existing.notes);
    const list = existing.windows.length > 0 ? existing.windows : [newWindow()];
    setWindows(list);
    setOpenIds(new Set([list[0].id]));
  }, [existing]);

  const status: SalesStatus = existing?.status ?? "draft";
  // 丈量單：新增時由網址決定，編輯時看這張單本身的標記
  const measureMode = isEdit ? existing?.measureOnly === true : pathname.startsWith("/sales/measure");
  // 已下單的單，業務不能再改；管理者可以
  const readOnly = isEdit && status !== "draft" && !isAdmin && !existing?.editApproved;

  const total = toNum(totalText);
  const deposit = toNum(depositText);
  const balance = balanceOf(total, deposit);

  const labels = windowLabels(windows);

  const patchWindow = (wid: string, patch: Partial<SalesWindow>) =>
    setWindows((prev) => prev.map((w) => (w.id === wid ? { ...w, ...patch } : w)));

  const toggleOpen = (wid: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(wid)) next.delete(wid);
      else next.add(wid);
      return next;
    });

  // 新增窗位時把其他的收起來，手機上不用一直往下捲
  const addWindow = () => {
    const w = newWindow();
    setWindows((prev) => [...prev, w]);
    setOpenIds(new Set([w.id]));
  };

  const duplicateWindow = (wid: string) => {
    // 複製出來的窗位預設「與上一個同窗」（常見用法：複製布改成紗）
    const copy = { ...windows.find((w) => w.id === wid)!, id: newWindowId(), sameAsPrev: !measureMode };
    setWindows((prev) => {
      const at = prev.findIndex((w) => w.id === wid);
      const next = [...prev];
      next.splice(at + 1, 0, copy);
      return next;
    });
    setOpenIds(new Set([copy.id]));
  };

  const moveWindow = (wid: string, delta: -1 | 1) =>
    setWindows((prev) => {
      const from = prev.findIndex((w) => w.id === wid);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const removeWindow = (wid: string) => {
    setWindows((prev) => {
      const next = prev.filter((w) => w.id !== wid);
      return next.length > 0 ? next : [newWindow()];
    });
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.delete(wid);
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async ({ target, measureOnly = measureMode }: SaveArgs) => {
      const input: SalesOrderInput = {
        ownerId: user?.id ?? "",
        person: person.trim(),
        kind,
        orderDate,
        installTime: installTime.trim(),
        scheduledInstallTime: scheduledInstallTime.trim(),
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        total,
        deposit,
        depositMethod,
        balanceMethod,
        notes: notes.trim(),
        measureOnly,
        status: target,
        editRequestStatus: existing?.editRequestStatus ?? "",
        editRequestReason: existing?.editRequestReason ?? "",
        editRequestAt: existing?.editRequestAt ?? "",
        editReviewedAt: existing?.editReviewedAt ?? "",
        editReviewedBy: existing?.editReviewedBy ?? "",
        editApproved: existing?.editApproved ?? false,
        // 完全空白的窗位不存
        windows: windows.filter((w) => !isBlankWindow(w)),
      };
      if (isEdit && existing) {
        await updateSalesOrder(id!, input, existing.status);
        return id!;
      }
      return createSalesOrder(input);
    },
    onSuccess: (savedId, { target, measureOnly = measureMode, after = "default" }) => {
      void qc.invalidateQueries({ queryKey: ["sales-orders"] });
      void qc.invalidateQueries({ queryKey: ["sales-inbox"] });
      void qc.invalidateQueries({ queryKey: ["sales-order", savedId] });
      void qc.invalidateQueries({ queryKey: ["sales-print"] });
      if (measureOnly) {
        toast("已存成丈量單");
        if (after === "print") navigate(`/sales/print?ids=${savedId}&type=measure`);
        else navigate("/sales");
      } else if (after === "stay") {
        toast("已轉成業務單，請把其他資料補齊");
      } else if (target === "draft") {
        toast("已存成草稿");
        navigate("/sales");
      } else {
        toast(isEdit ? "已儲存修改" : "已送出，管理者可以在待下單區看到這張單");
        navigate(`/sales/print?ids=${savedId}`);
      }
    },
    onError: (err) => {
      const code = (err as { code?: string }).code;
      toast(code === "permission-denied"
        ? "儲存失敗：修改權限可能已被重新鎖定，或安全規則尚未更新；請聯絡管理者。"
        : `儲存失敗：${(err as Error).message}`, { duration: 7000 });
      void qc.invalidateQueries({ queryKey: ["sales-order", id] });
    },
  });

  /** 送出（或修改已送出的單）前的必填檢查。 */
  const submit = (target: SalesStatus) => {
    const issues: string[] = [];
    if (!customerName.trim()) issues.push("請填客戶名稱");
    const filled = windows.filter((w) => !isBlankWindow(w));
    if (filled.length === 0) issues.push("請至少加入一個窗位");
    windows.forEach((w, i) => {
      if (isBlankWindow(w)) return;
      if (!w.product) issues.push(`第 ${i + 1} 個窗位還沒選品項`);
      SHAPE_SIDE_LABELS[w.shape].forEach((sideLabel, side) => {
        if (!w.shapeLengths[side]?.trim()) {
          issues.push(`第 ${i + 1} 個窗位的${sideLabel}尚未填寫`);
        }
      });
      if (w.mount === "wall" && w.wallOption === "") {
        issues.push(`第 ${i + 1} 個窗位的壁架請選「上移」或「鎖框」`);
      }
    });
    if (issues.length > 0) {
      toast(issues.slice(0, 3).join("；"));
      return;
    }
    save.mutate({ target });
  };

  /** 丈量單只要有客戶名稱就能存（之後才找得到）。after：存完去哪。 */
  const saveMeasure = (after: SaveArgs["after"], measureOnly = true) => {
    if (!customerName.trim()) {
      toast("請填客戶名稱");
      return;
    }
    save.mutate({ target: "draft", measureOnly, after });
  };

  if (isEdit && isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">載入中…</p>;
  }
  if (isEdit && (isError || !existing)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        <h1 className="text-lg font-semibold">找不到這張單</h1>
        <p className="text-sm text-muted-foreground">它可能已被刪除，或不是你的單。</p>
        <Button variant="outline" onClick={() => navigate("/sales")}>
          回我的單
        </Button>
      </div>
    );
  }

  const busy = save.isPending;
  const isNewOrDraft = !isEdit || status === "draft";

  return (
    <div className={cn("mx-auto flex max-w-2xl flex-col gap-5 pb-32", businessMode && "pb-52 md:pb-32")}>
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {measureMode ? (isEdit ? "編輯丈量單" : "新增丈量單") : isEdit ? "編輯業務單" : "新增業務單"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {measureMode
              ? "只要填客戶資料、尺寸和鎖點，其他等確認下單再補"
              : "先填客戶資料，再一個一個加窗位"}
          </p>
        </div>
      </div>

      {readOnly && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            {existing?.editRequestStatus === "pending"
              ? "修改申請審核中；目前仍不能修改。"
              : existing?.editRequestStatus === "rejected"
                ? "管理者已拒絕修改申請；訂單仍維持鎖定。"
                : "這張已送出的訂單目前已鎖定，請回「我的單」申請修改。"}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate(`/sales/print?ids=${id}`)}>
            <Printer className="size-4" /> 預覽／匯出
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">客戶資料</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="公司件／業務件">
            <Choice
              value={kind}
              disabled={readOnly}
              options={(Object.keys(KIND_LABELS) as SalesKind[]).map((value) => ({
                value,
                label: KIND_LABELS[value],
              }))}
              onChange={(v) => v && setKind(v)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="負責人">
              <Input
                className="h-11 text-base"
                value={person}
                disabled={readOnly}
                onChange={(e) => {
                  personTouched.current = true;
                  setPerson(e.target.value);
                }}
                placeholder="負責人"
              />
            </Field>
            <Field label="日期">
              <Input
                className="h-11 text-base"
                type="date"
                value={orderDate}
                disabled={readOnly}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </Field>
          </div>

          {!measureMode && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="預計安裝時間">
              <Input
                className="h-11 text-base"
                value={installTime}
                disabled={readOnly}
                onChange={(e) => setInstallTime(e.target.value)}
                placeholder="例如：11月底"
              />
            </Field>
            <Field label="排定安裝時間">
              <Input
                className="h-11 text-base"
                value={scheduledInstallTime}
                disabled={readOnly}
                onChange={(e) => setScheduledInstallTime(e.target.value)}
                placeholder="例如：11/5 下午 2:00"
              />
            </Field>
          </div>
          )}

          <Field label="客戶名稱 *">
            <Input
              className="h-11 text-base"
              value={customerName}
              disabled={readOnly}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="客戶名稱"
            />
          </Field>

          <Field label="電話">
            <Input
              className="h-11 text-base"
              type="tel"
              inputMode="tel"
              value={phone}
              disabled={readOnly}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="電話"
            />
          </Field>

          <Field label="地址">
            <Input
              className="h-11 text-base"
              value={address}
              disabled={readOnly}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="安裝地址"
            />
          </Field>
        </CardContent>
      </Card>

      {measureMode ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">備註</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              className="text-base"
              value={notes}
              disabled={readOnly}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：客戶想換掉舊窗簾、有小孩"
            />
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">金額</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="總價">
            <Input
              className="h-11 text-base"
              inputMode="numeric"
              value={totalText}
              disabled={readOnly}
              onChange={(e) => setTotalText(digitsOnly(e.target.value))}
              placeholder="0"
            />
          </Field>
          <Field label="訂金">
            <Input
              className="h-11 text-base"
              inputMode="numeric"
              value={depositText}
              disabled={readOnly}
              onChange={(e) => setDepositText(digitsOnly(e.target.value))}
              placeholder="0"
            />
            <Choice
              value={depositMethod}
              options={PAY_OPTIONS}
              disabled={readOnly}
              onChange={(v) => setDepositMethod(v as PayMethod)}
            />
          </Field>
          <Field label="尾款（總價 − 訂金，自動計算）">
            <div className="flex h-11 items-center rounded-md border border-input bg-muted/40 px-3 text-base font-semibold tabular-nums">
              {total > 0 || deposit > 0 ? fmtMoney(balance) : "—"}
            </div>
            <Choice
              value={balanceMethod}
              options={PAY_OPTIONS}
              disabled={readOnly}
              onChange={(v) => setBalanceMethod(v as PayMethod)}
            />
          </Field>
          <Field label="訂單備註">
            <Textarea
              rows={3}
              className="text-base"
              value={notes}
              disabled={readOnly}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：急件、先送一半"
            />
          </Field>
        </CardContent>
      </Card>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">窗位（{windows.length}）</h2>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={addWindow}>
              <Plus className="size-4" /> 新增窗位
            </Button>
          )}
        </div>

        {windows.map((w, i) => (
          <WindowCard
            key={w.id}
            index={i + 1}
            label={labels[i]}
            total={windows.length}
            win={w}
            open={openIds.has(w.id)}
            disabled={readOnly}
            onToggle={() => toggleOpen(w.id)}
            onChange={(patch) => patchWindow(w.id, patch)}
            onDuplicate={() => duplicateWindow(w.id)}
            onMove={(delta) => moveWindow(w.id, delta)}
            onRemove={() => setRemoveTarget(w.id)}
            measureMode={measureMode}
          />
        ))}

        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            className="h-12 border-dashed text-base"
            onClick={addWindow}
          >
            <Plus className="size-5" /> 再加一個窗位
          </Button>
        )}
      </div>

      {!readOnly && (
        <div className={cn(
          "print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur",
          businessMode ? "bottom-[calc(4rem+max(0.5rem,env(safe-area-inset-bottom)))] md:bottom-0 md:left-0" : "md:left-64",
        )}>
          <div className="mx-auto flex max-w-2xl gap-2">
            {measureMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 flex-1 px-2 text-sm"
                  disabled={busy || !user}
                  onClick={() => saveMeasure("default")}
                >
                  <Save className="size-4" /> 存丈量單
                </Button>
                <Button
                  type="button"
                  variant={isEdit ? "outline" : "default"}
                  className="h-12 flex-1 px-2 text-sm"
                  disabled={busy || !user}
                  onClick={() => saveMeasure("print")}
                >
                  <Printer className="size-4" /> 存並列印
                </Button>
                {isEdit && (
                  <Button
                    type="button"
                    className="h-12 flex-1 px-2 text-sm"
                    disabled={busy || !user}
                    onClick={() => saveMeasure("stay", false)}
                  >
                    <FileCheck2 className="size-4" /> 轉成業務單
                  </Button>
                )}
              </>
            ) : isNewOrDraft ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 flex-1 text-base"
                  disabled={busy || !user}
                  onClick={() => save.mutate({ target: "draft" })}
                >
                  <Save className="size-5" /> 存草稿
                </Button>
                <Button
                  type="button"
                  className="h-12 flex-1 text-base"
                  disabled={busy || !user}
                  onClick={() => submit("submitted")}
                >
                  <Send className="size-5" /> {busy ? "送出中…" : "送出下單"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="h-12 flex-1 text-base"
                disabled={busy || !user}
                onClick={() => submit(status)}
              >
                <Save className="size-5" /> {busy ? "儲存中…" : "儲存修改"}
              </Button>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除這個窗位？</AlertDialogTitle>
            <AlertDialogDescription>刪除後這個窗位填的內容就沒有了。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) removeWindow(removeTarget);
                setRemoveTarget(null);
              }}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** 用網址上的 id 當 key，從一張單切到另一張時表單會整個重來。 */
export default function SalesForm() {
  const { id } = useParams();
  const { pathname } = useLocation();
  return (
    <SalesGuard>
      <SalesFormInner key={id ?? (pathname.startsWith("/sales/measure") ? "new-measure" : "new")} />
    </SalesGuard>
  );
}
