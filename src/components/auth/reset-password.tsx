import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * 從「重設密碼信」連結進入時，蓋在整個畫面上：先設定新密碼才能繼續使用。
 * 信件連結會帶著 mode=resetPassword 與 oobCode 回到這個網址，auth 端會在
 * 載入時讀到並把 recovery 設為 true，所以這裡不看路由，只看 recovery 旗標。
 */
export function ResetPassword() {
  const { recovery, updatePassword, completeRecovery, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  if (!recovery) return null;

  const handleSave = async () => {
    if (password.length < 6) {
      toast("密碼至少 6 碼");
      return;
    }
    if (password !== confirm) {
      toast("兩次輸入的密碼不一致");
      return;
    }
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      toast(`設定失敗：${error}`, { duration: 6000 });
      return;
    }
    // 換掉網址上的 token，並把路由帶回應用首頁
    window.location.hash = "#/orders";
    completeRecovery();
    toast("密碼已更新");
  };

  const handleLater = async () => {
    completeRecovery();
    await signOut();
    window.location.hash = "#/login";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-brand p-4">
      <Card className="relative my-auto w-full max-w-sm overflow-hidden border-gold/25">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        <CardHeader className="items-center pt-8 text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-xl bg-gold text-gold-foreground shadow-sm">
            <KeyRound className="size-6" />
          </span>
          <CardTitle className="text-xl tracking-tight">設定新密碼</CardTitle>
          <CardDescription>
            您是從重設密碼信進來的，請設定新的密碼
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">新密碼</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="至少 6 碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password-confirm">再次輸入新密碼</Label>
              <Input
                id="new-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button className="mt-1" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "設定中…" : "儲存新密碼"}
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => void handleLater()}
            >
              稍後再設定，先回登入頁
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
