import type { CategoryBriefView, CategoryView } from '@/types/apps/open-platform';

type CategoryNameSource = CategoryView | CategoryBriefView;

function firstAvailableName(names: Record<string, string>) {
  return Object.values(names).find((value) => value.trim().length > 0) ?? '';
}

export function categoryLabel(
  category: CategoryNameSource,
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
) {
  const localizedName =
    category.names[locale] ?? category.names[locale === 'zh-CN' ? 'zh' : 'en'];
  return localizedName || firstAvailableName(category.names) || category.categoryCode;
}

export function categoryEnglishLabel(category: CategoryNameSource) {
  const englishName = category.names['en-US'] ?? category.names.en;
  return englishName || firstAvailableName(category.names) || category.categoryCode;
}

export function categoryPath(category: CategoryView) {
  return [...category.parentPath.map((parent) => categoryLabel(parent)), categoryLabel(category)].join(
    ' / ',
  );
}

/** 将接口返回的品类树展开，供按编码查找及树控件索引使用。 */
export function flattenCategoryTree(
  categories: CategoryView[],
  parents: CategoryBriefView[] = [],
): CategoryView[] {
  return categories.flatMap((category) => [
    { ...category, parentPath: parents },
    ...flattenCategoryTree(category.children ?? [], [
      ...parents,
      { categoryCode: category.categoryCode, names: category.names },
    ]),
  ]);
}
