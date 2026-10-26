import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ProductDetailView, ProductMetadataUpdateRequest } from '@/types/apps/open-platform';

export function ProductMetadataDialog({ product, busy, onClose, onSave }: {
  product: ProductDetailView;
  busy: boolean;
  onClose: () => void;
  onSave: (body: ProductMetadataUpdateRequest) => Promise<void>;
}) {
  const [name, setName] = useState(product.productName);
  const [description, setDescription] = useState(product.description ?? '');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy && name.trim()) void onSave({ productName: name.trim(), description: description.trim() });
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>编辑基本信息</DialogTitle>
        <DialogDescription>保存后更新产品展示，不改变发布状态和设备连接配置。</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-2"><Label htmlFor="product-metadata-name">产品名称</Label><Input id="product-metadata-name" value={name} onChange={event => setName(event.target.value)} maxLength={128} required disabled={busy} /></div>
        <div className="grid gap-2"><Label htmlFor="product-metadata-description">产品描述</Label><Textarea id="product-metadata-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={2048} rows={3} disabled={busy} placeholder="补充产品用途或说明，可留空" /></div>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" disabled={busy || !name.trim()}>{busy ? '保存中…' : '保存'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
