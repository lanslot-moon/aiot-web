import { useState } from 'react';
import useSWR from 'swr';
import { Input } from '@/components/ui/input';
import { policyRequest, query, type Page } from '@/api/policy/client';
import { Failure, Field, Pager, selectClass } from './shared';

interface Product { productId: string; productName: string }
export default function ProductPicker({ projectId, value, onChange, disabled }: { projectId: string; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [cursors, setCursors] = useState<string[]>(['']);
  const cursor = cursors[cursors.length - 1];
  const resource = useSWR([projectId, 'policy-product-picker', cursor], () => policyRequest<Page<Product>>(projectId, 'products' + query({ cursor, pageSize: 20 })));
  return <div className="space-y-2"><Field title="所属产品" hint="通信策略仅用于所选产品的设备。"><select className={selectClass} value={value} disabled={disabled || resource.isLoading} onChange={e => onChange(e.target.value)}><option value="">{resource.isLoading ? '正在读取产品…' : '请选择产品'}</option>{value && !resource.data?.items.some(p => p.productId === value) && <option value={value}>{value}</option>}{resource.data?.items.map(p => <option key={p.productId} value={p.productId}>{p.productName} · {p.productId}</option>)}</select></Field><Failure error={resource.error} retry={() => resource.mutate()} />{resource.data && !resource.data.items.length && <p className="text-xs text-muted-foreground">当前页没有产品，可先前往产品管理创建。</p>}{(cursors.length > 1 || resource.data?.hasMore) && <Pager previous={cursors.length > 1 ? () => setCursors(c => c.slice(0, -1)) : undefined} next={resource.data?.hasMore && resource.data.nextCursor ? () => setCursors(c => [...c, resource.data!.nextCursor!]) : undefined} busy={disabled || resource.isValidating} />}<details className="text-xs text-muted-foreground"><summary className="cursor-pointer">直接填写产品 ID</summary><Input aria-label="产品 ID" className="mt-2" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} /></details></div>;
}
