import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  deviceRequest,
  groupPath,
  query,
  type CursorPage,
  type DeviceGroup,
  type DeviceSummary,
} from '@/api/device/client';
import { OpenPlatformApiError } from '@/api/iam/client';
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
import { Failure } from './shared';

type ScopeItem = DeviceSummary | DeviceGroup;
type SearchField = 'name' | 'id';

function itemId(item: ScopeItem) {
  return 'deviceId' in item ? item.deviceId : item.groupId;
}

function itemName(item: ScopeItem) {
  return 'deviceName' in item ? item.deviceName : item.name;
}

async function getScopeResults(projectId: string, path: string, groupById: boolean) {
  if (!groupById) return deviceRequest<CursorPage<ScopeItem>>(projectId, path);

  try {
    const group = await deviceRequest<DeviceGroup>(projectId, path);
    return { items: [group], nextCursor: null, hasMore: false };
  } catch (error) {
    if (error instanceof OpenPlatformApiError && error.status === 404) {
      return { items: [], nextCursor: null, hasMore: false };
    }
    throw error;
  }
}

export default function ScopeSearch({
  projectId,
  productId,
  group = false,
  selected,
  onSelect,
}: {
  projectId: string;
  productId: string;
  group?: boolean;
  selected: string[];
  onSelect: (id: string) => void;
}) {
  const label = group ? '设备组' : '设备';
  const [field, setField] = useState<SearchField>('name');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const term = input.trim();
  const groupById = group && field === 'id';

  useEffect(() => {
    if (term === search) return;
    const timer = window.setTimeout(() => setSearch(term), 300);
    return () => window.clearTimeout(timer);
  }, [search, term]);

  const waiting = term !== search;
  const path = groupById
    ? search && groupPath(search)
    : (group ? 'device-groups' : 'devices') + query({
      productId: group ? undefined : productId,
      keyword: field === 'name' ? search : undefined,
      deviceId: field === 'id' ? search : undefined,
      pageSize: 20,
    });
  const resource = useSWR(
    open && !waiting && path ? [projectId, 'ota-scope-search', path, groupById] : null,
    ([id, , requestPath, exactGroup]) => getScopeResults(id, requestPath, exactGroup),
  );
  const loading = waiting || resource.isLoading;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0">
        <SearchFieldSelect<SearchField>
          label={label + '查询字段'}
          value={field}
          options={[
            { value: 'name', label: label + '名称' },
            { value: 'id', label: label + ' ID' },
          ]}
          onChange={(value) => {
            setField(value);
            setInput('');
            setSearch('');
            setOpen(false);
          }}
        />
        <Combobox
          items={resource.data?.items ?? []}
          filter={null}
          value={null}
          inputValue={input}
          onInputValueChange={setInput}
          open={open}
          onOpenChange={setOpen}
          openOnInputClick
          autoHighlight
          itemToStringLabel={itemName}
          onValueChange={(item: ScopeItem | null) => {
            if (!item) return;
            onSelect(itemId(item));
            setInput('');
            setSearch('');
            setOpen(false);
          }}
        >
          <ComboboxInput
            aria-label={'搜索并选择' + label}
            placeholder={field === 'id' ? '输入完整' + label + ' ID' : '输入' + label + '名称前缀'}
            maxLength={field === 'id' ? 64 : 128}
            className="min-w-0 flex-1 rounded-l-none! rounded-r-lg! [&_input]:text-xs!"
            showClear
          />
          <ComboboxContent className="min-w-0 rounded-lg!">
            <ComboboxEmpty className="px-3 py-4">
              {loading ? '正在搜索…' : resource.error ? '搜索失败'
                : groupById && !term ? '请输入完整设备组 ID' : '没有匹配的' + label}
            </ComboboxEmpty>
            <ComboboxList className="max-h-56">
              <ComboboxCollection>
                {(item: ScopeItem) => {
                  const id = itemId(item);
                  const added = selected.includes(id);
                  return (
                    <ComboboxItem key={id} value={item} disabled={added}>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate">{itemName(item)}</span>
                        <span className="truncate font-mono text-xs text-muted-foreground">{id}</span>
                      </span>
                      {added && <span className="text-xs text-muted-foreground">已选</span>}
                    </ComboboxItem>
                  );
                }}
              </ComboboxCollection>
            </ComboboxList>
            {resource.data?.hasMore && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                显示前 20 条，可缩小搜索范围或打开完整列表。
              </p>
            )}
          </ComboboxContent>
        </Combobox>
      </div>
      <Failure error={resource.error} retry={() => resource.mutate()} />
    </div>
  );
}
