import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  Calculator,
  CloudOff,
  Database,
  Download,
  Handshake,
  LogOut,
  Menu,
  Pencil,
  ReceiptText,
  Tags,
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
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/orders", label: "叫貨單", icon: ReceiptText },
  { to: "/reconciliation", label: "月對帳", icon: Calculator },
  { to: "/vendors", label: "廠商", icon: Handshake },
  { to: "/prices", label: "價格表", icon: Tags },
  { to: "/setup", label: "舊資料匯入", icon: Database },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
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
        </NavLink>
      ))}
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

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { offline, stopOffline } = useAuth();

  const handleExport = () => {
    const { orders, items } = downloadOfflineExport();
    toast(`已匯出 ${orders} 張叫貨單、${items} 筆明細，請把 JSON 檔保存好`);
  };

  return (
    <div className="flex h-full w-full">
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
      <main className="h-full flex-1 overflow-y-auto bg-background">
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
