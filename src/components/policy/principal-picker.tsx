import { useEffect, useState } from 'react';
import { request } from '@/api/iam/client';
import type { ProjectMemberVO, RoleVO } from '@/api/iam/contracts';
import { gatewayPath, type DeviceGroup, type DeviceSummary } from '@/api/device/client';
import { query, principalLabels, type Page, type PrincipalType } from '@/api/policy/client';
import { useResource } from '@/components/iam/shared-utils';
import { Input } from '@/components/ui/input';
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox';
import { Failure, Field, Pager } from './shared';

interface Target { id: string; name: string }
interface Product { productId: string; productName: string }

export default function PrincipalPicker({ projectId, type, scopeProductId, value, onChange, disabled }: { projectId: string; type: Exclude<PrincipalType, 'APPLICATION'>; scopeProductId: string | null; value: string; onChange: (id: string) => void; disabled: boolean }) {
  const [cursors, setCursors] = useState(['']);
  const [selected, setSelected] = useState<Target | null>(null);
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  useEffect(() => {
    if (type !== 'DEVICE') return;
    const timer = setTimeout(() => { setKeyword(search.trim()); setCursors(['']); }, 300);
    return () => clearTimeout(timer);
  }, [search, type]);
  const cursor = cursors[cursors.length - 1];
  const scope = encodeURIComponent(projectId);
  const paging = query({ pageSize: 20, cursor });
  const paths: Record<Exclude<PrincipalType, 'APPLICATION'>, string | null> = {
    DEVICE: scopeProductId ? gatewayPath(projectId, 'devices') + query({ productId: scopeProductId, keyword, pageSize: 20, cursor }) : null,
    PRODUCT: scopeProductId ? `/api/v1/products/${encodeURIComponent(scopeProductId)}` : null,
    STATIC_GROUP: gatewayPath(projectId, 'device-groups') + paging,
    ACCOUNT: `/api/v1/projects/${scope}/members` + query({ status: 'active', pageSize: 20, cursor }),
    TENANT_ROLE: `/api/v1/projects/${scope}/available-roles` + paging,
  };
  const permissions: Partial<Record<PrincipalType, string>> = { DEVICE: 'device:view', PRODUCT: 'product:view', STATIC_GROUP: 'device:view', ACCOUNT: 'project-member:view' };
  async function load(path: string): Promise<Page<Target>> {
    const get = <T,>() => request<T>(path, 'GET', undefined, { projectId });
    if (type === 'PRODUCT') {
      const product = await get<Product>();
      return { items: [{ id: product.productId, name: product.productName }], hasMore: false, nextCursor: null };
    }
    if (type === 'DEVICE') {
      const page = await get<Page<DeviceSummary>>();
      return { ...page, items: page.items.filter(device => device.productId === scopeProductId && device.lifecycle !== 'DELETING').map(device => ({ id: device.deviceId, name: device.deviceName })) };
    }
    if (type === 'STATIC_GROUP') {
      const page = await get<Page<DeviceGroup>>();
      return { ...page, items: page.items.map(group => ({ id: group.groupId, name: group.name })) };
    }
    if (type === 'ACCOUNT') {
      const page = await get<Page<ProjectMemberVO>>();
      return { ...page, items: page.items.filter(member => member.membershipStatus === 'ACTIVE').map(member => ({ id: member.accountId, name: member.username || member.accountId })) };
    }
    const page = await get<Page<RoleVO>>();
    return { ...page, items: page.items.filter(role => role.status === 'ACTIVE').map(role => ({ id: role.roleId, name: role.roleName })) };
  }
  const resource = useResource<Page<Target>>(paths[type], permissions[type], load, `policy-principal:${projectId}:${type}:${scopeProductId ?? ''}`);
  const items = resource.data?.items ?? [];
  const product = type === 'PRODUCT' && !resource.error ? items[0] : undefined;
  // 产品授权的对象由策略范围确定，详情读取成功后自动填入，不需要再次选择。
  useEffect(() => {
    if (type !== 'PRODUCT') return;
    const productId = product?.id === scopeProductId ? product.id : '';
    if (value !== productId) onChange(productId);
  }, [type, product?.id, scopeProductId, value, onChange]);
  const current = selected?.id === value ? selected : items.find(item => item.id === value) ?? null;
  const options = current && !items.some(item => item.id === current.id) ? [current, ...items] : items;
  if (!paths[type]) return <p role="status" className="text-xs text-destructive">此设备通信策略缺少所属产品，无法选择授权对象，请先核对策略配置。</p>;
  if (type === 'PRODUCT') return <div className="space-y-2">
    <Field title="所属产品" hint="创建策略时已确定所属产品。确认后，此策略将授权给该产品下的设备。">
      <Input aria-label="策略所属产品" value={product?.name ?? ''} placeholder={resource.isLoading ? '正在读取所属产品…' : '所属产品未加载'} readOnly />
    </Field>
    {product && <p className="break-all font-mono text-xs text-muted-foreground">产品 ID：{product.id}</p>}
    <Failure error={resource.error} retry={() => resource.mutate()} />
  </div>;
  return <div className="space-y-2">
    <Field title={`选择${principalLabels[type]}`} hint={type === 'DEVICE' ? '分页读取策略所属产品的设备，输入名称从服务端搜索。' : type === 'STATIC_GROUP' ? '选择当前项目的静态设备组；此策略仍只适用于所属产品的设备。' : '仅列出当前项目可用的对象；按名称或 ID 搜索当前页。'}>
      <Combobox items={options} value={current} disabled={disabled} itemToStringLabel={(item: Target) => item.name} isItemEqualToValue={(a: Target, b: Target) => a.id === b.id} filter={type === 'DEVICE' ? null : (item: Target, search: string) => `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase())} onInputValueChange={(text, details) => { if (details.reason === 'input-change' || details.reason === 'input-clear') setSearch(text); }} onValueChange={(item: Target | null) => { setSelected(item); onChange(item?.id ?? ''); }}>
        <ComboboxInput aria-label={`选择授权${principalLabels[type]}`} className="w-full" placeholder={type === 'DEVICE' ? '选择设备或输入名称搜索' : '选择或搜索当前页名称、ID'} showClear />
        <ComboboxContent>
          {resource.isLoading || (type === 'DEVICE' && search.trim() !== keyword) ? <p role="status" className="px-3 py-5 text-sm text-muted-foreground">正在读取…</p> : resource.error ? <div className="p-3"><Failure error={resource.error} retry={() => resource.mutate()} /></div> : <><ComboboxEmpty className="px-3 py-5">当前页没有匹配的对象，可尝试翻页或修改搜索条件</ComboboxEmpty><ComboboxList className="max-h-56"><ComboboxCollection>{(item: Target) => <ComboboxItem key={item.id} value={item}><span className="grid min-w-0 gap-1"><span className="truncate">{item.name}</span><span className="truncate font-mono text-xs text-muted-foreground">{item.id}</span></span></ComboboxItem>}</ComboboxCollection></ComboboxList></>}
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2"><span className="text-xs text-muted-foreground">第 {cursors.length} 页 · 每页 20 条</span><Pager busy={disabled || resource.isValidating || (type === 'DEVICE' && search.trim() !== keyword)} previous={cursors.length > 1 ? () => setCursors(items => items.slice(0, -1)) : undefined} next={resource.data?.hasMore && resource.data.nextCursor ? () => setCursors(items => [...items, resource.data!.nextCursor!]) : undefined} /></div>
        </ComboboxContent>
      </Combobox>
    </Field>
    {current && <p className="break-all font-mono text-xs text-muted-foreground">对象 ID：{current.id}</p>}
    <Failure error={resource.error} retry={() => resource.mutate()} />
  </div>;
}
