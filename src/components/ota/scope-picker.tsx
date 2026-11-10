import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceTable } from '@/components/device/layout';
import { Pager } from '@/components/policy/shared';
import {
  deviceRequest,
  query,
  type CursorPage,
  type DeviceSummary,
  type DeviceGroup,
} from '@/api/device/client';
import { Failure, Input, Loading, Modal } from './shared';
export default function ScopePicker({
  projectId,
  productId,
  group,
  selected,
  onChange,
  onClose,
  confirmLabel = '确认选择',
  busy = false,
  error,
}: {
  projectId: string;
  productId: string;
  group?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void | Promise<boolean>;
  onClose: () => void;
  confirmLabel?: string;
  busy?: boolean;
  error?: unknown;
}) {
  const [ids, setIds] = useState(selected);
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState(['']);
  const path =
    (group ? 'device-groups' : 'devices') +
    query({
      ...(group ? { keyword: search } : { productId, deviceName: search }),
      cursor: cursors[cursors.length - 1],
      pageSize: 20,
    });
  const resource = useSWR([projectId, 'ota-scope', path], () =>
    deviceRequest<CursorPage<DeviceSummary | DeviceGroup>>(projectId, path),
  );
  return (
    <Modal
      title={group ? '选择设备组' : '选择设备'}
      open
      wide
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground">
            已选 {ids.length} {group ? '个设备组' : '台设备'}
          </span>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={busy || !ids.length}
            onClick={async () => {
              if ((await onChange(ids)) !== false) onClose();
            }}
          >
            {busy ? '提交中…' : confirmLabel}
          </Button>
        </>
      }
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(keyword.trim());
          setCursors(['']);
        }}
      >
        <Input
          aria-label="搜索设备范围"
          value={keyword}
          placeholder={group ? '搜索设备组' : '搜索当前产品的设备名称'}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="submit" variant="outline">
          搜索
        </Button>
      </form>
      <Failure error={resource.error} retry={() => resource.mutate()} />
      <Failure error={error} />
      {resource.isLoading ? (
        <Loading />
      ) : (
        <DeviceTable
          rows={resource.data?.items ?? []}
          columns={[
            {
              label: '选择',
              render: (r) => {
                const id = 'deviceId' in r ? r.deviceId : r.groupId;
                return (
                  <Checkbox
                    aria-label={`选择 ${'deviceName' in r ? r.deviceName : r.name}`}
                    checked={ids.includes(id)}
                    disabled={busy}
                    onCheckedChange={(value) =>
                      setIds((current) =>
                        value
                          ? group
                            ? [id]
                            : [...new Set([...current, id])]
                          : current.filter((v) => v !== id),
                      )
                    }
                  />
                );
              },
            },
            {
              label: group ? '设备组名称' : '设备名称',
              render: (r) => ('deviceName' in r ? r.deviceName : r.name),
            },
            {
              label: 'ID',
              render: (r) => (
                <span className="font-mono text-xs">
                  {'deviceId' in r ? r.deviceId : r.groupId}
                </span>
              ),
            },
          ]}
        />
      )}
      <Pager
        busy={resource.isValidating}
        previous={cursors.length > 1 ? () => setCursors((c) => c.slice(0, -1)) : undefined}
        next={
          resource.data?.hasMore && resource.data.nextCursor
            ? () => setCursors((c) => [...c, resource.data!.nextCursor!])
            : undefined
        }
      />
    </Modal>
  );
}
