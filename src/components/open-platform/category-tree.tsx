import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Folder,
  FolderOpen,
  Search,
  X,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { categoryEnglishLabel, categoryLabel } from '@/lib/open-platform-category';
import { cn } from '@/lib/utils';
import type { CategoryView } from '@/types/apps/open-platform';

const ROOT_KEY = '__root__';

export function CategoryTree({
  categories,
  selectedCode,
  onSelect,
  selectableLeafOnly = false,
  disabled = false,
  fillHeight = false,
  actions,
}: {
  categories: CategoryView[];
  selectedCode?: string;
  onSelect: (category: CategoryView) => void;
  selectableLeafOnly?: boolean;
  disabled?: boolean;
  fillHeight?: boolean;
  actions?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const childrenByParent = useMemo(() => {
    const map = new Map<string, CategoryView[]>();
    categories.forEach((category) => {
      const parentKey = category.parentCode ?? ROOT_KEY;
      const children = map.get(parentKey) ?? [];
      children.push(category);
      map.set(parentKey, children);
    });
    map.forEach((children) => {
      children.sort(
        (left, right) =>
          left.sort - right.sort ||
          categoryLabel(left).localeCompare(categoryLabel(right), 'zh-CN'),
      );
    });
    return map;
  }, [categories]);

  useEffect(() => {
    setExpanded(new Set());
  }, [categories]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCodes = useMemo(() => {
    if (!normalizedQuery) {
      return new Set(categories.map((category) => category.categoryCode));
    }

    const matches = (category: CategoryView) =>
      [
        categoryLabel(category),
        categoryEnglishLabel(category),
        category.categoryCode,
        ...category.parentPath.flatMap((parent) => [
          categoryLabel(parent),
          categoryEnglishLabel(parent),
        ]),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));

    const hasMatchInBranch = (category: CategoryView): boolean => {
      if (matches(category)) return true;
      return (childrenByParent.get(category.categoryCode) ?? []).some(hasMatchInBranch);
    };

    return new Set(
      categories
        .filter((category) => hasMatchInBranch(category))
        .map((category) => category.categoryCode),
    );
  }, [categories, childrenByParent, normalizedQuery]);

  const toggleExpanded = (categoryCode: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(categoryCode)) next.delete(categoryCode);
      else next.add(categoryCode);
      return next;
    });
  };

  const renderNode = (category: CategoryView, depth: number): React.ReactNode => {
    if (!visibleCodes.has(category.categoryCode)) return null;

    const children = childrenByParent.get(category.categoryCode) ?? [];
    const isExpanded = normalizedQuery.length > 0 || expanded.has(category.categoryCode);
    const canSelect = !selectableLeafOnly || category.leaf;
    const isSelected = selectedCode === category.categoryCode;
    const NodeIcon = category.leaf ? CircleDot : isExpanded ? FolderOpen : Folder;
    const label = categoryLabel(category);

    return (
      <div key={category.categoryCode} className="relative">
        <div
          className={cn(
            'relative flex items-center gap-0.5 py-0',
            depth > 0 &&
              'before:absolute before:top-0 before:bottom-0 before:left-2 before:border-l before:border-border/70',
          )}
          style={{ paddingLeft: `${depth * 1.25}rem` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className="relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => toggleExpanded(category.categoryCode)}
              aria-label={isExpanded ? `收起${label}` : `展开${label}`}
              aria-expanded={isExpanded}
              disabled={disabled}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5" aria-hidden />
              )}
            </button>
          ) : (
            <span className="inline-flex size-6 shrink-0" aria-hidden />
          )}

          <button
            type="button"
            className={cn(
              'group relative z-10 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              canSelect
                ? 'hover:bg-muted/80'
                : 'cursor-default text-muted-foreground/70',
              isSelected && 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20',
            )}
            onClick={() => {
              if (canSelect) onSelect(category);
            }}
            disabled={disabled || !canSelect}
            aria-current={isSelected ? 'true' : undefined}
            title={!canSelect ? '创建产品时请选择叶子品类' : undefined}
          >
            <NodeIcon
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-colors',
                isSelected && 'text-primary',
                !category.leaf && 'group-hover:text-foreground',
              )}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-normal">{label}</span>
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {categoryEnglishLabel(category)}
              </span>
            </span>
          </button>
        </div>

        {children.length > 0 && isExpanded
          ? children.map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  };

  const roots = childrenByParent.get(ROOT_KEY) ?? [];
  const hasVisibleRoot = roots.some((category) => visibleCodes.has(category.categoryCode));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索品类名称或编码"
            className="pr-9 pl-8"
            aria-label="搜索品类"
            disabled={disabled}
          />
          {query ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => setQuery('')}
              aria-label="清除品类搜索"
              disabled={disabled}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-muted/10 p-1.5">
        <div className="flex items-center justify-between px-1.5 pb-1.5 text-[11px] text-muted-foreground">
          <span>{categories.length} 个品类节点</span>
          <span>{selectableLeafOnly ? '仅可选择叶子品类' : '点击节点查看详情'}</span>
        </div>
        <div
          className={cn(
            'overflow-y-auto overscroll-contain pr-1',
            fillHeight ? 'h-[28rem]' : 'h-72',
          )}
          role="region"
          aria-label="品类树"
          tabIndex={0}
        >
          {roots.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">暂无品类数据</p>
          ) : !hasVisibleRoot ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              没有匹配的品类
            </p>
          ) : (
            roots.map((category) => renderNode(category, 0))
          )}
        </div>
      </div>

    </div>
  );
}
