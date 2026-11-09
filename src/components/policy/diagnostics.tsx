import { formatDateTime } from '@/lib/date-time';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { platformResourceType, policyRequest, query, principalLabels, type Snapshot, type Simulation, type Effective, type Page, type PrincipalType } from '@/api/policy/client';
import { mqttActionOptions } from '@/api/policy/channels';
import { usePlatformPolicyPermissions } from '@/hooks/use-platform-policy-permissions';
import { CatalogFailure, Failure, Field, PolicySelect } from './shared';

type Mode = 'snapshot' | 'effective' | 'simulation';
const simulationPrincipals: PrincipalType[] = ['DEVICE', 'ACCOUNT', 'TENANT_ROLE'];

export default function Diagnostics({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<Mode>('snapshot');
  const [principalType, setPrincipalType] = useState<PrincipalType>('DEVICE');
  const [principalId, setPrincipalId] = useState('');
  const [productId, setProductId] = useState('');
  const [source, setSource] = useState('EFFECTIVE');
  const [policyId, setPolicyId] = useState('');
  const [version, setVersion] = useState('1');
  const [mqttAction, setMqttAction] = useState('mqtt:Publish');
  const [platformAction, setPlatformAction] = useState('');
  const [operationId, setOperationId] = useState('PROPERTY_REPORT');
  const [resourceId, setResourceId] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [effective, setEffective] = useState<Page<Effective> | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const device = mode === 'snapshot' || principalType === 'DEVICE';
  const platform = usePlatformPolicyPermissions(projectId, mode === 'simulation' && !device);
  const selectedPermission = platform.data?.find(permission => permission.permissionCode === platformAction);
  const connect = device && mqttAction === 'mqtt:Connect';
  const clientId = `${productId.trim()}:${principalId.trim()}`;
  const action = device ? mqttAction : platformAction;
  const resourceType = device ? (connect ? 'mqtt-client' : 'mqtt-operation') : selectedPermission && platformResourceType(selectedPermission.permissionCode);
  const targetId = connect ? clientId : resourceId.trim();
  function clear() { setSnapshot(null); setSimulation(null); setEffective(null); setError(undefined); }
  function changeMode(next: Mode) {
    if (next === 'simulation' && !simulationPrincipals.includes(principalType)) {
      setPrincipalType('DEVICE'); setPrincipalId(''); setResourceId('');
    }
    if ((next === 'snapshot' || mode === 'snapshot') && principalType !== 'DEVICE') setPrincipalId('');
    setMode(next); clear();
  }
  async function run(cursor?: string) {
    if (!principalId.trim() || (device && !productId.trim())) { setError(new Error(device ? '请填写设备 ID 和产品 ID。' : `请填写${principalLabels[principalType]} ID。`)); return; }
    if (mode === 'simulation' && (!action || !resourceType || !targetId || (device && !connect && !operationId.trim()) || (source !== 'EFFECTIVE' && !policyId.trim()) || (source === 'VERSION' && (!Number.isSafeInteger(Number(version)) || Number(version) < 1)))) { setError(new Error('请补全模拟所需的策略、操作与资源。')); return; }
    setBusy(true); clear();
    try {
      if (mode === 'snapshot') setSnapshot(await policyRequest<Snapshot>(projectId, 'mqtt-access-snapshots/preview', 'POST', { deviceId: principalId.trim(), productId: productId.trim(), clientId }));
      if (mode === 'effective') setEffective(await policyRequest<Page<Effective>>(projectId, 'effective-policies' + query({ principalType, principalId: principalId.trim(), productId: device ? productId.trim() : undefined, cursor, pageSize: 20 })));
      if (mode === 'simulation') setSimulation(await policyRequest<Simulation>(projectId, 'authorization-decisions/simulation', 'POST', {
        sourceType: source, ...(source !== 'EFFECTIVE' ? { policyId: policyId.trim() } : {}), ...(source === 'VERSION' ? { versionNo: Number(version) } : {}),
        principal: { principalType, principalId: principalId.trim(), ...(device ? { deviceId: principalId.trim(), productId: productId.trim(), clientId } : {}) },
        requests: [{ requestId: 'console-check', action, resourceType, resourceId: targetId, ...(device && !connect ? { operationId: operationId.trim() } : {}), context: {} }],
      }));
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <div className="space-y-5"><div><h2 className="text-base font-semibold">权限排查</h2><p className="mt-1 text-sm text-muted-foreground">查看后端计算的通道和策略来源，或模拟一次授权判断。查询不会修改权限。</p></div>
    <form onSubmit={e => { e.preventDefault(); void run(); }} onChange={clear} className="max-w-6xl space-y-3">
      <fieldset disabled={busy} className="space-y-3">
        <div className="grid items-end gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field title="排查方式"><PolicySelect label="排查方式" disabled={busy} value={mode} onValueChange={value => changeMode(value as Mode)} options={[{ value: 'snapshot', label: '设备 MQTT 通道' }, { value: 'effective', label: '生效的自定义策略' }, { value: 'simulation', label: '模拟授权判断' }]} /></Field>
          {mode !== 'snapshot' && <Field title="主体类型"><PolicySelect label="主体类型" disabled={busy} value={principalType} onValueChange={value => { setPrincipalType(value as PrincipalType); setPrincipalId(''); setResourceId(''); clear(); }} options={Object.entries(principalLabels).filter(([value]) => mode !== 'simulation' || simulationPrincipals.some(type => type === value)).map(([value, label]) => ({ value, label }))} /></Field>}
          <Field title={`${device ? '设备' : principalLabels[principalType]} ID`}><Input value={principalId} onChange={e => setPrincipalId(e.target.value)} /></Field>
          {device && <Field title="产品 ID"><Input value={productId} onChange={e => setProductId(e.target.value)} /></Field>}
        </div>
        {mode === 'simulation' && <>
          <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field title="规则来源"><PolicySelect label="规则来源" disabled={busy} value={source} onValueChange={value => { setSource(value); clear(); }} options={[{ value: 'EFFECTIVE', label: device ? '生效策略与标准 MQTT 通道' : '生效的自定义策略' }, { value: 'DRAFT', label: '仅指定策略的草稿' }, { value: 'VERSION', label: '仅指定策略的历史版本' }]} /></Field>
            {source !== 'EFFECTIVE' && <Field title="策略 ID"><Input value={policyId} onChange={e => setPolicyId(e.target.value)} /></Field>}
            {source === 'VERSION' && <Field title="版本号"><Input type="number" min={1} value={version} onChange={e => setVersion(e.target.value)} /></Field>}
            {device ? <Field title="MQTT 操作"><PolicySelect label="MQTT 操作" disabled={busy} value={mqttAction} onValueChange={value => { setMqttAction(value); setResourceId(''); clear(); }} options={mqttActionOptions} /></Field> :
              <Field title="平台权限"><PolicySelect label="平台权限" disabled={busy || !platform.data?.length} value={platformAction} onValueChange={value => { setPlatformAction(value); setResourceId(''); clear(); }} options={[{ value: '', label: platform.isLoading ? '正在读取权限目录…' : '请选择平台权限' }, ...(platform.data ?? []).map(item => ({ value: item.permissionCode, label: item.permissionName ? `${item.permissionName} · ${item.permissionCode}` : item.permissionCode }))]} /></Field>}
            <Field title="资源类型"><Input value={resourceType ?? ''} readOnly /></Field>
            {connect ? <Field title="MQTT Client ID"><Input value={clientId} readOnly /></Field> :
              <Field title="资源 ID" hint={device ? undefined : '填写具体资源 ID，例如设备 ID。'}><Input value={resourceId} onChange={e => setResourceId(e.target.value)} /></Field>}
            {device && !connect && <Field title="通信操作标识"><Input value={operationId} onChange={e => setOperationId(e.target.value)} /></Field>}
          </div>
          {!device && <CatalogFailure projectId={projectId} source="platform" error={platform.error} retry={() => platform.mutate()} />}
          <p className="text-xs text-muted-foreground">{device ? '设备模拟仅覆盖 MQTT 授权。设备 ATOP 接口可通过“生效的自定义策略”查看绑定。' : '模拟只检查 Policy 的资源规则，实际请求还要通过平台权限和业务校验。'}</p>
        </>}
      </fieldset>
      <Failure error={error} /><Button type="submit" disabled={busy || (mode === 'simulation' && !device && !selectedPermission)}><Search className="size-4" />{busy ? '查询中…' : '查询授权结果'}</Button>
    </form>
    {snapshot && <div className="space-y-4" aria-live="polite"><div className="rounded-lg bg-muted/40 p-4"><h3 className="font-medium">{snapshot.allowedConnect ? '策略允许连接' : '策略不允许连接'}</h3><p className="mt-1 text-xs text-muted-foreground">{snapshot.decisionCode} · 求值于 {formatDateTime(snapshot.evaluatedAt)}</p><p className="mt-2 text-sm">这是授权预览，不代表设备认证通过、在线或 Broker 已应用该结果。</p></div>{snapshot.warnings?.map(w => <p className="text-sm text-amber-700 dark:text-amber-400" key={w}>{w}</p>)}<GatewayDataTable rows={snapshot.rules ?? []} columns={[{ label: '设备操作', render: r => r.action === 'PUBLISH' ? '发布' : '订阅' }, { label: 'Topic', render: r => <span className="block max-w-xl break-all">{r.topic}</span> }, { label: 'QoS', render: r => r.qos?.join(' / ') }, { label: 'Retain', render: r => r.retain ? '允许' : '不允许' }]} /><p className="break-all text-sm text-muted-foreground">绑定来源：{snapshot.bindingSources?.join('、') || '无自定义绑定；标准通道由平台内置提供。'}</p></div>}
    {effective && !error && <div className="space-y-3"><p className="text-sm text-muted-foreground">这里只列出自定义策略。没有记录不代表设备没有标准通信权限。</p><GatewayDataTable rows={effective.items} columns={[{ label: '策略', render: r => <div>{r.policyName}<p className="mt-1 text-xs text-muted-foreground">{r.policyId}</p></div> }, { label: '版本', render: r => 'v' + r.policyVersionNo }, { label: '授权来源', render: r => <div>{principalLabels[r.bindingSourceType as PrincipalType] ?? r.bindingSourceType}<p className="mt-1 break-all text-xs text-muted-foreground">{r.bindingSourceId}</p></div> }, { label: '到期时间', render: r => <span className="whitespace-nowrap text-xs text-muted-foreground">{r.expiresAt ? formatDateTime(r.expiresAt) : '长期有效'}</span> }]} />{effective.hasMore && effective.nextCursor && <Button variant="outline" disabled={busy} onClick={() => void run(effective.nextCursor!)}>下一页</Button>}</div>}
    {simulation && <div className="space-y-3" aria-live="polite">{simulation.results.map((result, index) => <div key={index} className="space-y-2 rounded-lg border p-5"><h3 className="font-medium">{result.allowed ? '允许此操作' : '不允许此操作'}</h3><p className="text-xs text-muted-foreground">{result.decisionCode}</p><p className="text-sm">命中允许：{result.matchedAllows?.join('、') || '无'}</p><p className="text-sm">命中禁止：{result.matchedDenies?.join('、') || '无'}</p>{result.missingRequirements?.map(x => <p className="text-sm text-destructive" key={x}>{x}</p>)}</div>)}</div>}
  </div>;
}
