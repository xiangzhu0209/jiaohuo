import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Phone } from "lucide-react";
import { createVendor, deleteVendor, fetchVendors, updateVendor } from "@/lib/db";
import type { Vendor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface EditorState {
  vendor: Vendor | null;
  open: boolean;
}

export default function Vendors() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<EditorState>({ vendor: null, open: false });
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
  });

  const openCreate = () => {
    setEditor({ vendor: null, open: true });
    setName("");
    setPhone("");
    setNotes("");
  };

  const openEdit = (v: Vendor) => {
    setEditor({ vendor: v, open: true });
    setName(v.name);
    setPhone(v.phone ?? "");
    setNotes(v.notes ?? "");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editor.vendor) {
        await updateVendor(editor.vendor.id, name.trim(), phone.trim(), notes.trim());
      } else {
        await createVendor(name.trim(), phone.trim(), notes.trim());
      }
    },
    onSuccess: () => {
      toast(editor.vendor ? "廠商已更新" : "廠商已新增");
      setEditor({ vendor: null, open: false });
      void qc.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err) => toast(`儲存失敗：${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteVendor(id);
    },
    onSuccess: () => {
      toast("廠商已刪除");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err) => toast(`刪除失敗：${(err as Error).message}`),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("請輸入廠商名稱");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">廠商管理</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">管理配合的叫貨廠商</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 新增廠商
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">廠商列表</CardTitle>
              <CardDescription>管理叫貨廠商與聯絡資訊</CardDescription>
            </div>
            <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-gold-text">
              共 {vendors.length} 家
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">載入中…</p>
          ) : vendors.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              尚無廠商，點右上角「新增廠商」開始建立
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名稱</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead className="hidden md:table-cell">備註</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5 text-muted-foreground" />
                        {v.phone || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                      {v.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="編輯" onClick={() => openEdit(v)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="刪除"
                          onClick={() => setDeleteTarget(v)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editor.open} onOpenChange={(o) => setEditor((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor.vendor ? "編輯廠商" : "新增廠商"}</DialogTitle>
            <DialogDescription>
              {editor.vendor ? `正在編輯「${editor.vendor.name}」` : "填寫新廠商資料"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="v-name">名稱 *</Label>
              <Input
                id="v-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：永利"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="v-phone">電話</Label>
              <Input
                id="v-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例如：0912-345-678"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="v-notes">備註</Label>
              <Textarea
                id="v-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditor({ vendor: null, open: false })}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "儲存中…" : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除廠商？</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.name}」嗎？此操作無法復原。
              若該廠商仍有叫貨單紀錄，叫貨單會保留但不再顯示廠商名稱。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
