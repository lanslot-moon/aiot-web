import { useState } from 'react';
import useSWR from 'swr';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { policyRequest, query, type Page } from '@/api/policy/client';
import { Failure, Field, Pager } from './shared';

interface Product { productId: string; productName: string }
export default function ProductPicker({ projectId, value, onChange, disabled }: { projectId: string; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [cursors, setCursors] = useState<string[]>(['']);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const cursor = cursors[cursors.length - 1];
  const resource = useSWR([projectId, 'policy-product-picker', 'PUBLISHED', cursor], () => policyRequest<Page<Product>>(projectId, 'products' + query({ lifecycleStatus: 'PUBLISHED', cursor, pageSize: 20 })));
  const products = resource.data?.items ?? [];
  const selected = products.find(product => product.productId === value)
    ?? (selectedProduct?.productId === value ? selectedProduct : null)
    ?? (value ? { productId: value, productName: value } : null);
  const options = selected && !products.some(product => product.productId === value) ? [selected, ...products] : products;

  return (
    <div className="min-w-0 space-y-3">
      <Field title="所属产品" hint="仅显示已发布产品，可搜索当前页的名称或 ID。">
        <Combobox
          items={options}
          value={selected}
          itemToStringLabel={(product: Product) => product.productName}
          isItemEqualToValue={(a: Product, b: Product) => a.productId === b.productId}
          filter={(product: Product, search: string) => (product.productName + ' ' + product.productId).toLowerCase().includes(search.toLowerCase())}
          disabled={disabled || resource.isLoading}
          onValueChange={(product: Product | null) => { setSelectedProduct(product); onChange(product?.productId ?? ''); }}
        >
          <ComboboxInput className="w-full rounded-md!" aria-label="所属产品" placeholder={resource.isLoading ? '正在读取产品…' : '选择或搜索产品'} disabled={disabled || resource.isLoading} showClear />
          <ComboboxContent className="min-w-0">
            <ComboboxEmpty className="px-3 py-6">{products.length ? '当前页没有匹配的产品' : '当前页暂无已发布产品'}</ComboboxEmpty>
            <ComboboxList className="max-h-64">
              <ComboboxCollection>
                {(product: Product) => (
                  <ComboboxItem key={product.productId} value={product} className="py-2.5">
                    <span className="grid min-w-0 gap-1">
                      <span className="truncate font-medium" title={product.productName}>{product.productName}</span>
                      <span className="truncate text-xs text-muted-foreground" title={product.productId}>{product.productId}</span>
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>
      <Failure error={resource.error} retry={() => resource.mutate()} />
      {resource.data && !products.length && <p className="text-xs text-muted-foreground">当前页没有已发布产品，可先前往产品管理发布产品。</p>}
      {(cursors.length > 1 || resource.data?.hasMore) && (
        <div className="flex items-center justify-between gap-3 [&>div]:mt-0">
          <span className="text-xs text-muted-foreground">第 {cursors.length} 页 · {products.length} 个产品</span>
          <Pager previous={cursors.length > 1 ? () => setCursors(c => c.slice(0, -1)) : undefined} next={resource.data?.hasMore && resource.data.nextCursor ? () => setCursors(c => [...c, resource.data!.nextCursor!]) : undefined} busy={disabled || resource.isValidating} />
        </div>
      )}
      <Collapsible>
        <CollapsibleTrigger disabled={disabled} render={<Button type="button" variant="ghost" size="sm" className="group -ml-2 text-xs text-muted-foreground" />}>
          <ChevronDown className="size-3.5 transition-transform group-data-panel-open:rotate-180" />直接填写产品 ID
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Input aria-label="产品 ID" placeholder="输入完整产品 ID" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
