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
