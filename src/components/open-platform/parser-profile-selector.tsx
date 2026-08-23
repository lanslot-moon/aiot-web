import { useEffect, useMemo, useState } from 'react';

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import type { ParserProfileVersionView, ParserProfileView } from '@/types/apps/open-platform';

interface SearchOption {
  value: string;
  label: string;
  meta?: string;
}

interface SearchableOptionSelectProps {
  value: string;
  options: SearchOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onValueChange: (value: string) => void;
}

function SearchableOptionSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loading = false,
  disabled = false,
  invalid = false,
  onValueChange,
}: SearchableOptionSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const [inputValue, setInputValue] = useState(selectedOption?.label ?? '');

  useEffect(() => {
    setInputValue(selectedOption?.label ?? '');
  }, [selectedOption?.value]);

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={(nextOption) => {
        const next = nextOption as SearchOption | null;
        onValueChange(next?.value ?? '');
        setInputValue(next?.label ?? '');
      }}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      itemToStringLabel={(option) => (option as SearchOption | null)?.label ?? ''}
      disabled={disabled || loading}
    >
      <ComboboxInput
        className="rounded-md!"
        placeholder={loading ? '加载中…' : placeholder}
        aria-label={searchPlaceholder}
        aria-invalid={invalid || undefined}
        showTrigger
        showClear
      />
      <ComboboxContent className="bg-popover before:hidden">
        <ComboboxList>
          <ComboboxEmpty>{options.length === 0 ? emptyLabel : `没有匹配的${searchPlaceholder.replace('搜索 ', '')}。`}</ComboboxEmpty>
          <ComboboxCollection>
            {(option: SearchOption) => (
              <ComboboxItem key={option.value} value={option}>
                <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                  <span className="min-w-0 truncate font-medium text-foreground">{option.label}</span>
                  {option.meta ? (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{option.meta}</span>
                  ) : null}
                </span>
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

interface ParserProfileSelectProps {
  profiles: ParserProfileView[];
  value: string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onValueChange: (value: string) => void;
}

export function ParserProfileSelect({
  profiles,
  value,
  loading,
  disabled,
  invalid,
  onValueChange,
}: ParserProfileSelectProps) {
  const options = useMemo(
    () => profiles.map((profile) => ({
      value: profile.profileId,
      label: profile.profileName,
      meta: `${profile.protocolCode} · v${profile.currentVersion}`,
    })),
    [profiles],
  );

  return (
    <SearchableOptionSelect
      value={value}
      options={options}
      placeholder="选择已发布 Profile"
      searchPlaceholder="搜索 Profile 名称、协议编码或 ID"
      emptyLabel="暂无已发布 Profile"
      loading={loading}
      disabled={disabled}
      invalid={invalid}
      onValueChange={onValueChange}
    />
  );
}

interface ParserProfileVersionSelectProps {
  versions: ParserProfileVersionView[];
  value: string;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onValueChange: (value: string) => void;
}

export function ParserProfileVersionSelect({
  versions,
  value,
  placeholder = '选择已发布版本',
  loading,
  disabled,
  invalid,
  onValueChange,
}: ParserProfileVersionSelectProps) {
  const options = useMemo(
    () => versions.map((version) => ({
      value: version.profileVersion,
      label: `v${version.profileVersion}`,
      meta: '已发布',
    })),
    [versions],
  );

  return (
    <SearchableOptionSelect
      value={value}
      options={options}
      placeholder={placeholder}
      searchPlaceholder="搜索 Profile 版本"
      emptyLabel="暂无已发布版本"
      loading={loading}
      disabled={disabled}
      invalid={invalid}
      onValueChange={onValueChange}
    />
  );
}
