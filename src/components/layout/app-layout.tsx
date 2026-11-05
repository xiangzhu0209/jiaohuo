import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Calculator,
  ClipboardList,
  CloudOff,
  Database,
  Download,
  FilePlus2,
  Handshake,
  Inbox,
  LogOut,
  Menu,
  Pencil,
  ReceiptText,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { downloadOfflineExport } from "@/lib/db-offline";
import { fetchSalesOrdersByStatus, fetchSalesOrdersWithEditRequests } from "@/lib/sales-db";
import { isAdminEmail } from "@/lib/sales-types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 只有網址完全相同才算「目前所在頁」（避免 /sales 在 /sales/new 也亮起來） */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/orders", label: "叫貨單", icon: ReceiptText },
  { to: "/reconciliation", label: "月對帳", icon: Calculator },
  { to: "/vendors", label: "廠商", icon: Handshake },
  { to: "/prices", label: "價格表", icon: Tags },
  { to: "/setup", label: "舊資料匯入", icon: Database },
];

const SALES_ITEMS: NavItem[] = [
  { to: "/sales/new", label: "新增業務單", icon: FilePlus2 },
  { to: "/sales", label: "我的單", icon: ClipboardList, end: true },
];

const INBOX_ITEM: NavItem = { to: "/sales/inbox", label: "待下單區", icon: Inbox };
const MEMBERS_ITEM: NavItem = { to: "/sales/members", label: "業務帳號管理", icon: Users };

function NavGroup({
  title,
  items,
  badges,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  badges?: Record<string, number>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-[11px] font-medium tracking-[0.14em] text-sidebar-foreground/45">
        {title}
      </p>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-200",
              "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:transition-opacity",
              isActive
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:bg-sidebar-primary"
                : "text-sidebar-foreground/70 before:opacity-0 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {label}
          {(badges?.[to] ?? 0) > 0 && (
            <span className="ml-auto rounded-full bg-sidebar-primary px-2 py-0.5 text-[11px] font-semibold leading-none text-sidebar-primary-foreground">
              {badges?.[to]}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user, offline } = useAuth();
  // 業務下單需要連上雲端，離線模式不顯示
  const showSales = !offline;
  const isAdmin = showSales && isAdminEmail(user?.email);

  // 管理者：選單上顯示待下單的數量（每分鐘自動更新）
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["sales-inbox", "submitted"],
    enabled: isAdmin,
    queryFn: () => Promise.all([
      fetchSalesOrdersByStatus("submitted"),
      fetchSalesOrdersWithEditRequests(),
    ]),
    refetchInterval: 60_000,
    select: ([orders, editRequests]) => orders.length + editRequests.length,
  });

  return (
    <nav className="flex flex-col gap-5">
      <NavGroup title="叫貨管理" items={NAV_ITEMS} onNavigate={onNavigate} />
      {showSales && (
        <NavGroup
          title="業務下單"
          items={isAdmin ? [...SALES_ITEMS, INBOX_ITEM, MEMBERS_ITEM] : SALES_ITEMS}
          badges={{ [INBOX_ITEM.to]: pendingCount }}
          onNavigate={onNavigate}
        />
      )}
    </nav>
  );
}

function BrandMark({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <Link to="/orders" className="flex items-center gap-2.5 px-1">
      <span
        className={cn(
          "flex items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
          size === "md" ? "size-9" : "size-8",
        )}
      >
        <ReceiptText className={size === "md" ? "size-5" : "size-4"} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          叫貨單系統
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-primary">
          Order System
        </span>
      </span>
    </Link>
  );
}

function SidebarFooter() {
  const { user, profileName, offline, signOut, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setName(profileName);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast("請輸入姓名");
      return;
    }
    setSaving(true);
    const { error } = await updateProfile(name);
    setSaving(false);
    if (error) {
      toast(`儲存失敗：${error}`);
      return;
    }
    toast("姓名已更新");
    setOpen(false);
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <Separator className="bg-sidebar-border" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
              {(profileName || user?.email || "未").trim().slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {profileName || user?.email || "未登入"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {offline
                  ? "離線模式・尚未同步"
                  : profileName
                    ? user?.email
                    : "點鉛筆設定姓名"}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              title="設定姓名"
              onClick={openEdit}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              title="登出"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-sidebar-foreground/50">外觀主題</span>
          <ThemeToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>設定姓名</DialogTitle>
            <DialogDescription>
              您的姓名會印在叫貨單的「出單人」欄位
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">姓名</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：王小明"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SalesOnlyWorkspace() {
  const { user, profileName, signOut } = useAuth();
  const { pathname } = useLocation();
  // 業務填單、我的單與編輯頁都保留手機底部切換列；唯獨待核准及列印頁不顯示。
  const showMobileTabs = pathname.startsWith("/sales")
    && pathname !== "/sales/pending"
    && pathname !== "/sales/print";
  const links: NavItem[] = [
    { to: "/sales/new", label: "新增業務單", icon: FilePlus2 },
    { to: "/sales", label: "我的單", icon: ClipboardList, end: true },
  ];
  return (
    <div className="flex min-h-full w-full flex-col bg-background">
      <header className="print-hidden sticky top-0 z-30 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-3 px-4 py-2 md:min-h-16 md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ReceiptText className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold md:text-base">業務下單</p>
              <p className="truncate text-xs text-muted-foreground">{profileName || user?.email || "業務帳號"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="min-h-10 shrink-0" onClick={() => void signOut()}>
            <LogOut className="size-4" /> <span className="hidden sm:inline">登出</span>
          </Button>
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-2 px-8 pb-2 md:flex">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                "flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 pb-24 md:pb-8">
        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 md:px-8 md:py-7">
          <Outlet />
        </div>
      </main>
      {showMobileTabs && (
        <nav className="print-hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t bg-card/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_hsl(var(--foreground)/0.06)] backdrop-blur md:hidden">
          {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-accent",
            )}
          >
            <Icon className="size-5" /> {label}
          </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { offline, stopOffline, user, salesMember, membershipLoading, businessAccount } = useAuth();
  const isAdmin = isAdminEmail(user?.email);

  if (!offline && !isAdmin && (businessAccount || !!salesMember)) {
    if (membershipLoading) {
      return <p className="py-16 text-center text-sm text-muted-foreground">正在確認帳號權限…</p>;
    }
    const pending = salesMember?.status !== "active";
    if (pending && location.pathname !== "/sales/pending") {
      return <Navigate to="/sales/pending" replace />;
    }
    if (!pending && location.pathname === "/sales/pending") {
      return <Navigate to="/sales/new" replace />;
    }
    if (!location.pathname.startsWith("/sales")) {
      return <Navigate to={pending ? "/sales/pending" : "/sales/new"} replace />;
    }
    return <SalesOnlyWorkspace />;
  }

  const handleExport = () => {
    const { orders, items } = downloadOfflineExport();
    toast(`已匯出 ${orders} 張叫貨單、${items} 筆明細，請把 JSON 檔保存好`);
  };

  return (
    <div className="flex h-full w-full print:block print:h-auto">
      {/* Desktop sidebar */}
      <aside className="print-hidden hidden w-64 shrink-0 flex-col gap-7 border-r border-sidebar-border bg-gradient-brand px-4 py-6 md:flex">
        <BrandMark />
        <div className="flex flex-1 flex-col justify-between">
          <NavLinks />
          <SidebarFooter />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="print-hidden flex items-center justify-between border-b border-sidebar-border bg-sidebar-background px-4 py-3 md:hidden">
        <BrandMark size="sm" />
        <div className="flex items-center gap-1">
          <ThemeToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 border-sidebar-border bg-sidebar-background text-sidebar-foreground"
            >
              <SheetTitle className="sr-only">選單</SheetTitle>
              <div className="flex h-full flex-col justify-between py-2">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
                <SidebarFooter />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Content */}
      <main className="h-full flex-1 overflow-y-auto bg-background print:h-auto print:overflow-visible">
        <div className="mx-auto max-w-5xl p-4 md:p-8 print:max-w-none print:p-0">
          {offline && (
            <div className="print-hidden mb-6 flex flex-col gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <CloudOff className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    離線模式（還沒同步到雲端）
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    今天的資料只存在這台電腦的瀏覽器。請固定用同一個瀏覽器與網址下單；
                    完成後按「匯出資料」把 JSON 檔保存下來，之後再匯入雲端。
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="size-4" /> 匯出資料
                </Button>
                <Button variant="ghost" size="sm" onClick={stopOffline}>
                  結束離線
                </Button>
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
