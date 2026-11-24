import { useState } from 'react';
import useSWR from 'swr';
import { SearchFieldSelect } from '@/components/shared/search-field-select';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
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
  showSearchHint = true,
}: {
  projectId: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  publishedOnly?: boolean;
  compact?: boolean;
  showSearchHint?: boolean;
}) {
  const [field, setField] = useState<'productName' | 'productId'>('productName');
  const [typedId, setTypedId] = useState('');
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

  const manualProduct = field === 'productId' && typedId && !options.some(
    (product) => product.productId.toLowerCase() === typedId.toLowerCase(),
  ) ? { productName: typedId, productId: typedId } : null;

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
        </div>
        <div className="flex min-w-0">
          <SearchFieldSelect
            label="产品查询字段"
            className="w-25"
            value={field}
            disabled={disabled}
            options={[
              { value: 'productName', label: '产品名称' },
              { value: 'productId', label: '产品 ID' },
            ]}
            onChange={(nextField) => {
              setField(nextField);
              setTypedId('');
              setOpen(false);
            }}
          />
          <Combobox
            key={field}
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) setTypedId('');
            }}
            onInputValueChange={(text, details) => {
              setTypedId(details.reason === 'input-change' ? text.trim() : '');
            }}
            items={manualProduct ? [...options, manualProduct] : options}
            value={selected}
            itemToStringLabel={(product: Product) => product[field]}
            isItemEqualToValue={(a: Product, b: Product) => a.productId === b.productId}
            filter={(product: Product, search: string) =>
              product[field].toLowerCase().includes(search.trim().toLowerCase())
            }
            disabled={disabled}
            onValueChange={(product: Product | null) => {
              setSelectedProduct(product);
              onChange(product?.productId ?? '');
            }}
          >
            <ComboboxInput
              className="min-w-0 flex-1 rounded-l-none! rounded-r-lg! [&_input]:text-xs!"
              aria-label="所属产品"
              placeholder={field === 'productId' ? '搜索或输入完整产品 ID' : '输入产品名称搜索'}
              disabled={disabled}
              showClear
            />
            <ComboboxContent className="min-w-0">
              <ComboboxEmpty className="px-3 py-6">
                {resource.isLoading ? '正在读取产品…' : products.length
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
                          {product === manualProduct ? '使用此产品 ID' : product.productName}
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
        </div>
        {!compact && showSearchHint && (
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
    </div>
  );
}
