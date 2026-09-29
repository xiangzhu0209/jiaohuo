import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createPrice, deletePrice, fetchPrices, fetchVendors, updatePrice } from "@/lib/db";
import type { PriceItem } from "@/lib/types";
import { fmtMoney, toNum } from "@/lib/order-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  item: PriceItem | null;
  open: boolean;
}

export default function Prices() {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState<string>("");
  const [editor, setEditor] = useState<EditorState>({ item: null, open: false });
  const [deleteTarget, setDeleteTarget] = useState<PriceItem | null>(null);
  const [productName, setProductName] = useState("");
  const [spec, setSpec] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
  });

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["prices", vendorId],
    enabled: !!vendorId,
    queryFn: () => fetchPrices(vendorId),
  });

  const openCreate = () => {
    setEditor({ item: null, open: true });
    setProductName("");
    setSpec("");
    setUnit("");
    setUnitPrice("");
    setNotes("");
  };

  const openEdit = (p: PriceItem) => {
    setEditor({ item: p, open: true });
    setProductName(p.productName);
    setSpec(p.spec ?? "");
    setUnit(p.unit ?? "");
    setUnitPrice(String(p.unitPrice));
    setNotes(p.notes ?? "");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        productName: productName.trim(),
        spec: spec.trim(),
        unit: unit.trim(),
        unitPrice: toNum(unitPrice),
        notes: notes.trim(),
      };
      if (editor.item) {
        await updatePrice(editor.item.id, payload);
      } else {
        await createPrice(vendorId, payload);
      }
    },
    onSuccess: () => {
      toast(editor.item ? "價格已更新" : "價格已新增");
      setEditor({ item: null, open: false });
      void qc.invalidateQueries({ queryKey: ["prices", vendorId] });
    },
    onError: (err) => toast(`儲存失敗：${(err as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deletePrice(id);
    },
    onSuccess: () => {
      toast("價格已刪除");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["prices", vendorId] });
    },
    onError: (err) => toast(`刪除失敗：${(err as Error).message}`),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      toast("請先選擇廠商");
      return;
    }
    if (!productName.trim()) {
      toast("請輸入品名");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">廠商價格表</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          建立各廠商的品項與單價，叫貨時可自動帶入
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-base">價格明細</CardTitle>
            <CardDescription>選擇廠商後管理其品項價格</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="選擇廠商" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} disabled={!vendorId}>
              <Plus className="size-4" /> 新增品項
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!vendorId ? (
            <p className="py-12 text-center text-sm text-muted-foreground">請先選擇廠商</p>
          ) : isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">載入中…</p>
          ) : prices.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              此廠商尚無價格資料，點「新增品項」建立
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>品名</TableHead>
                  <TableHead>規格</TableHead>
                  <TableHead>單位</TableHead>
                  <TableHead className="text-right">單價</TableHead>
                  <TableHead className="hidden md:table-cell">備註</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{p.spec || "—"}</TableCell>
                    <TableCell>{p.unit || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(toNum(p.unitPrice))}</TableCell>
                    <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground md:table-cell">
                      {p.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="編輯" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="刪除"
                          onClick={() => setDeleteTarget(p)}
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
            <DialogTitle>{editor.item ? "編輯價格" : "新增品項"}</DialogTitle>
            <DialogDescription>
              {vendors.find((v) => v.id === vendorId)?.name ?? "廠商"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-name">品名 *</Label>
              <Input
                id="p-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="例如：普軌 / 窗簾布 / 掛座"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-spec">規格</Label>
                <Input
                  id="p-spec"
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  placeholder="例如：292cm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-unit">單位</Label>
                <Input
                  id="p-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="例如：支 / 隻"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-price">單價 *</Label>
              <Input
                id="p-price"
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-notes">備註</Label>
              <Input
                id="p-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditor({ item: null, open: false })}>
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
            <AlertDialogTitle>刪除此價格？</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.productName}」的價格資料嗎？
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
