import { Action, DataTable, ErrorNotice, Loading } from '@/components/iam/shared';
import { deviceRequest, type Tags } from '@/api/device/client';
import { EmptyState } from './shared';
import { useDeviceResource } from './use-device-resource';

export default function ResourceTags({ projectId, path, readOnly = false }: { projectId: string; path: string; readOnly?: boolean }) {
  const resource = useDeviceResource<Tags>(projectId, `${path}/tags`);
  async function change(upserts: Record<string, string>, removeKeys: string[]) {
    const result = await deviceRequest<Tags>(projectId, `${path}/tag-changes`, 'POST', { upserts, removeKeys });
    await resource.mutate(result, { revalidate: false });
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">标签只作用于当前资源，不继承产品或成员的标签。</p>{!readOnly && resource.data && <Action label="设置标签" permission="device:update" description="设置指定键的值，其他标签保持不变。已有键会被更新，值允许为空。" fields={[{ name: 'key', label: '标签键', required: true, maxLength: 64 }, { name: 'value', label: '标签值', maxLength: 256 }]} run={v => change({ [v.key]: v.value }, [])} />}</div>
    <ErrorNotice error={resource.error} retry={() => resource.mutate()} />
    {resource.isLoading && <Loading />}
    {resource.data && (Object.keys(resource.data.tags).length ? <DataTable rows={Object.entries(resource.data.tags)} columns={[
      { label: '标签键', render: ([key]) => <span className="break-all">{key}</span> },
      { label: '标签值', render: ([, value]) => <span className="break-all">{value}</span> },
      ...(!readOnly ? [{ label: '操作', render: ([key]: [string, string]) => <Action label="移除标签" danger permission="device:update" description={`移除标签「${key}」，其他标签保持不变。`} run={() => change({}, [key])} /> }] : []),
    ]} /> : !resource.error && <EmptyState title="尚未设置标签" description="可以用标签记录位置、用途等静态分类信息。" />)}
  </div>;
}
