import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { usePermission } from '@/context/iam-context/identity';
import { useResource } from '@/components/iam/shared-utils';
import { request, OpenPlatformApiError } from '@/api/iam/client';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { DeviceInput as Input } from './layout';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DeviceSelect } from './shared';
import { deviceRequest, query, type CursorPage, type DeviceDetail } from '@/api/device/client';

interface ProductOption { productId: string; productName: string }

export default function CreateVirtualDevice({ projectId, done }: { projectId: string; done: (id: string) => void }) {
  const allowed = usePermission('device:create');
  const [open, setOpen] = useState(false);
  const [productMode, setProductMode] = useState<'select' | 'id'>('select');
  const [productId, setProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [name, setName] = useState('');
  const [cursors, setCursors] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<unknown>();
  const [invalid, setInvalid] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const path = '/api/v1/products' + query({ lifecycleStatus: 'PUBLISHED', pageSize: 20, cursor: cursors[cursors.length - 1] });
  const products = useResource<CursorPage<ProductOption>>(open && productMode === 'select' ? path : null, 'product:view', url => request(url, 'GET', undefined, { projectId }), `device-product-picker:${projectId}`);
  const options = products.data?.items ?? [];
  const allOptions = selectedProduct && !options.some(p => p.productId === selectedProduct.productId) ? [selectedProduct, ...options] : options;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current || uncertain) return;
    if (!productId.trim()) { setInvalid(true); document.getElementById(productMode === 'id' ? 'virtual-product-id' : 'virtual-product-select')?.focus(); return; }
    pending.current = true; setBusy(true); setError(undefined);
    try {
      const device = await deviceRequest<DeviceDetail>(projectId, 'virtual-devices', 'POST', { productId: productId.trim(), ...(name.trim() ? { deviceName: name.trim() } : {}) });
      toast.success('虚拟设备档案已创建'); setOpen(false); done(device.deviceId);
    } catch (failure) {
      setError(failure);
      // Creation has only short-window deduplication. Do not blindly repeat an uncertain request.
      if (failure instanceof OpenPlatformApiError && (failure.status >= 500 || ['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(failure.code))) setUncertain(true);
    } finally { pending.current = false; setBusy(false); }
  }
  return <>
    <Button disabled={!allowed} title={!allowed ? '需要创建设备权限' : undefined} onClick={() => { setProductMode('select'); setProductId(''); setSelectedProduct(null); setName(''); setCursors(['']); setError(undefined); setInvalid(false); setUncertain(false); setOpen(true); }}>创建虚拟设备</Button>
    <Dialog open={open} onOpenChange={v => { if (!pending.current) setOpen(v); }}><DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={!busy}><DialogHeader><DialogTitle>创建虚拟设备</DialogTitle><DialogDescription>仅创建待激活的设备档案。凭证准备和模拟运行需在对应服务中完成。</DialogDescription></DialogHeader>
      <form onSubmit={e => void submit(e)} className="space-y-4" aria-busy={busy}>
        <fieldset disabled={busy || uncertain} className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={productMode === 'id' ? 'virtual-product-id' : 'virtual-product-select'}>所属产品</Label>
              <Button type="button" variant="link" size="sm" onClick={() => { setProductMode(productMode === 'select' ? 'id' : 'select'); setProductId(''); setSelectedProduct(null); setInvalid(false); }}>{productMode === 'select' ? '填写产品 ID' : '选择已发布产品'}</Button>
            </div>
            {productMode === 'select' ? <>
              <ErrorNotice error={products.error} retry={() => products.mutate()} />
              {products.isLoading && <Loading />}
              {products.data && !products.error && <>
                <DeviceSelect id="virtual-product-select" label="选择已发布产品" value={productId} options={[{ value: '', label: '选择所属产品' }, ...allOptions.map(p => ({ value: p.productId, label: p.productName }))]} onChange={v => { setProductId(v); setSelectedProduct(allOptions.find(p => p.productId === v) ?? null); setInvalid(false); }} />
                {!options.length && <p className="text-sm text-muted-foreground">当前页没有已发布产品。</p>}
                {(cursors.length > 1 || products.data.hasMore) && <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-muted-foreground">产品第 {cursors.length} 页</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={products.isValidating || cursors.length === 1} onClick={() => setCursors(c => c.slice(0, -1))}>上一页</Button><Button type="button" variant="outline" size="sm" disabled={products.isValidating || !products.data.hasMore || !products.data.nextCursor} onClick={() => setCursors(c => [...c, products.data!.nextCursor!])}>下一页</Button></div></div>}
              </>}
            </> : <><Input id="virtual-product-id" value={productId} placeholder="输入完整产品 ID" maxLength={128} aria-invalid={invalid} aria-describedby={invalid ? 'virtual-product-error' : undefined} onChange={e => { setProductId(e.target.value); setInvalid(false); }} /><p className="text-sm text-muted-foreground">登记资格由服务端校验。</p></>}
            {invalid && <FieldError id="virtual-product-error">请选择产品或填写产品 ID</FieldError>}
          </div>
          <div className="space-y-2"><Label htmlFor="virtual-device-name">设备名称（选填）</Label><Input id="virtual-device-name" value={name} maxLength={128} onChange={e => setName(e.target.value)} /><p className="text-sm text-muted-foreground">留空由平台生成；创建后设备名称固定，昵称可编辑。</p></div>
        </fieldset>
        <ErrorNotice error={error} />
        {uncertain && <p role="status" className="text-sm">创建结果未确认，设备可能已经建档。请关闭并查询设备列表，核对后再决定是否创建另一台设备。</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>{uncertain ? '关闭并核对' : '取消'}</Button>{!uncertain && <Button type="submit" disabled={busy}>{busy ? '创建中…' : '创建设备档案'}</Button>}</DialogFooter>
      </form>
    </DialogContent></Dialog>
  </>;
}
