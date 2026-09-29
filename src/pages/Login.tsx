import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { CloudOff, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Mode = "login" | "signup" | "forgot";

const DESCRIPTIONS: Record<Mode, string> = {
  login: "登入您的帳號",
  signup: "建立新帳號",
  forgot: "輸入註冊時的信箱，我們會寄一封重設密碼信給您",
};

export default function Login() {
  const { user, loading, signIn, signUp, resetPassword, startOffline } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [offlineName, setOfflineName] = useState("");

  if (loading) return null;
  if (user) return <Navigate to="/orders" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 忘記密碼：只要信箱，寄出重設信
    if (mode === "forgot") {
      if (!email.trim()) {
        toast("請輸入信箱");
        return;
      }
      setSubmitting(true);
      const { error } = await resetPassword(email);
      setSubmitting(false);
      if (error) {
        toast(`寄送失敗：${error}`, { duration: 6000 });
        return;
      }
      setMode("login");
      toast("重設信已寄出，請收信（也看一下垃圾郵件匣）", { duration: 6000 });
      return;
    }

    if (!email || !password) {
      toast("請輸入信箱與密碼");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      toast("請輸入您的姓名");
      return;
    }
    setSubmitting(true);
    const { error } =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, name.trim());
    setSubmitting(false);
    if (error) {
      toast(error, { duration: 5000 });
      return;
    }
    if (mode === "signup") {
      toast("註冊成功，已自動登入");
    }
  };

  const submitLabel = submitting
    ? "處理中…"
    : mode === "login"
      ? "登入"
      : mode === "signup"
        ? "註冊"
        : "寄送重設信";

  return (
    <div className="relative flex min-h-full items-center justify-center bg-gradient-brand p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
      </div>
      <Card className="relative w-full max-w-sm overflow-hidden border-gold/25">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        <CardHeader className="items-center pt-8 text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-xl bg-gold text-gold-foreground shadow-sm">
            <ReceiptText className="size-6" />
          </span>
          <CardTitle className="text-xl tracking-tight">叫貨單系統</CardTitle>
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-gold-text">
            Order System
          </span>
          <CardDescription>{DESCRIPTIONS[mode]}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "signup" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">姓名 *</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="例如：王小明"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">信箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== "forgot" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">密碼</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="至少 6 碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" disabled={submitting} className="mt-1">
              {submitLabel}
            </Button>

            {mode === "login" && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => setMode("signup")}
                >
                  沒有帳號？註冊
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="-mt-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setMode("forgot")}
                >
                  忘記密碼？
                </Button>
                <div className="mt-1 rounded-md border border-dashed border-input/70 bg-muted/40 p-3">
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <CloudOff className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      如果一直登不進來（例如系統連不上），可先用
                      <span className="font-medium text-foreground">離線模式</span>
                      下單：資料存在這台電腦，之後匯出即可匯入雲端。
                    </span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={offlineName}
                      onChange={(e) => setOfflineName(e.target.value)}
                      placeholder="你的姓名（印在出單人）"
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        if (!offlineName.trim()) {
                          toast("請輸入姓名（會印在出單人）");
                          return;
                        }
                        startOffline(offlineName);
                      }}
                    >
                      離線下單
                    </Button>
                  </div>
                </div>
              </>
            )}
            {mode === "signup" && (
              <Button
                type="button"
                variant="ghost"
                className="text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => setMode("login")}
              >
                已有帳號？登入
              </Button>
            )}
            {mode === "forgot" && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setMode("login")}
              >
                返回登入
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
