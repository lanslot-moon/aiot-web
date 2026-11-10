import { useState } from 'react';
import useSWR from 'swr';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CircleHelp, ChevronDown } from 'lucide-react';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { policyRequest, query, type Page } from '@/api/policy/client';
import { Failure, Pager } from './shared';

interface Product {
  productId: string;
  productName: string;
}
export default function ProductPicker({
  projectId,
  value,
  onChange,
  disabled,
  publishedOnly = true,
  compact = false,
}: {
  projectId: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  publishedOnly?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cursors, setCursors] = useState<string[]>(['']);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const cursor = cursors[cursors.length - 1];
  const resource = useSWR([projectId, 'policy-product-picker', publishedOnly, cursor], () =>
    policyRequest<Page<Product>>(
      projectId,
      'products' +
        query({ lifecycleStatus: publishedOnly ? 'PUBLISHED' : undefined, cursor, pageSize: 20 }),
    ),
  );
  const products = resource.data?.items ?? [];
  const selected =
    products.find((product) => product.productId === value) ??
    (selectedProduct?.productId === value ? selectedProduct : null) ??
    (value ? { productId: value, productName: value } : null);
  const options =
    selected && !products.some((product) => product.productId === value)
      ? [selected, ...products]
      : products;

  const pagination = (cursors.length > 1 || resource.data?.hasMore) && (
    <div className="flex items-center justify-between gap-3 [&>div]:mt-0">
      <span className="text-xs text-muted-foreground">
        第 {cursors.length} 页 · {products.length} 个产品
      </span>
      <Pager
        previous={
          cursors.length > 1
            ? () => {
                setSelectedProduct(selected);
                setCursors((c) => c.slice(0, -1));
              }
            : undefined
        }
        next={
          resource.data?.hasMore && resource.data.nextCursor
            ? () => {
                setSelectedProduct(selected);
                setCursors((c) => [...c, resource.data!.nextCursor!]);
              }
            : undefined
        }
        busy={disabled || resource.isValidating}
      />
    </div>
  );
  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-2">
        <div className="flex h-5 items-center gap-1 text-xs font-medium">
          所属产品
          {compact && (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-5"
                    aria-label="产品选择说明"
                  />
                }
              >
                <CircleHelp className="size-3.5" />
              </PopoverTrigger>
              <PopoverContent className="space-y-2 text-xs" align="start">
                <p>可搜索当前页的产品名称或 ID，翻页可查看其他产品。</p>
                <label>
                  直接填写产品 ID
                  <Input
                    aria-label="产品 ID"
                    placeholder="输入完整产品 ID"
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                  />
                </label>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <Combobox
          key={cursor}
          open={open}
          onOpenChange={setOpen}
          items={options}
          value={selected}
          itemToStringLabel={(product: Product) => product.productName}
          isItemEqualToValue={(a: Product, b: Product) => a.productId === b.productId}
          filter={(product: Product, search: string) =>
            (product.productName + ' ' + product.productId)
              .toLowerCase()
              .includes(search.toLowerCase())
          }
          disabled={disabled || resource.isLoading}
          onValueChange={(product: Product | null) => {
            setSelectedProduct(product);
            onChange(product?.productId ?? '');
          }}
        >
          <ComboboxInput
            className="w-full rounded-md! [&_input]:text-xs!"
            aria-label="所属产品"
            placeholder={resource.isLoading ? '正在读取产品…' : '选择或搜索产品'}
            disabled={disabled || resource.isLoading}
            showClear
          />
          <ComboboxContent className="min-w-0">
            <ComboboxEmpty className="px-3 py-6">
              {products.length
                ? '当前页没有匹配的产品'
                : publishedOnly
                  ? '当前页暂无已发布产品'
                  : '当前页暂无产品'}
            </ComboboxEmpty>
            <ComboboxList className="max-h-64">
              <ComboboxCollection>
                {(product: Product) => (
                  <ComboboxItem key={product.productId} value={product} className="py-2 text-xs!">
                    <span className="grid min-w-0 gap-0.5">
                      <span
                        className="truncate text-xs font-normal leading-5"
                        title={product.productName}
                      >
                        {product.productName}
                      </span>
                      <span
                        className="truncate text-[11px] leading-4 text-muted-foreground"
                        title={product.productId}
                      >
                        {product.productId}
                      </span>
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxList>
            {compact && pagination && <div className="border-t p-2">{pagination}</div>}
          </ComboboxContent>
        </Combobox>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            {publishedOnly
              ? '仅显示已发布产品，可搜索当前页的名称或 ID。'
              : '可搜索当前页的产品名称或 ID。'}
          </p>
        )}
      </div>
      <Failure error={resource.error} retry={() => resource.mutate()} />
      {!compact && resource.data && !products.length && (
        <p className="text-xs text-muted-foreground">
          {publishedOnly
            ? '当前页没有已发布产品，可先前往产品管理发布产品。'
            : '当前页暂无产品，可先前往产品管理创建产品。'}
        </p>
      )}
      {!compact && pagination}
      {!compact && (
        <Collapsible>
          <CollapsibleTrigger
            disabled={disabled}
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="group -ml-2 text-xs text-muted-foreground"
              />
            }
          >
            <ChevronDown className="size-3.5 transition-transform group-data-panel-open:rotate-180" />
            直接填写产品 ID
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Input
              aria-label="产品 ID"
              placeholder="输入完整产品 ID"
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
