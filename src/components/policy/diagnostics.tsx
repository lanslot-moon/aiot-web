import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { policyRequest, query, formatTime, principalLabels, type Snapshot, type Simulation, type Effective, type Page, type PrincipalType } from '@/api/policy/client';
import { Failure, Field, selectClass } from './shared';

export default function Diagnostics({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState('snapshot');
  const [principalType, setPrincipalType] = useState<PrincipalType>('DEVICE');
  const [principalId, setPrincipalId] = useState('');
  const [productId, setProductId] = useState('');
  const [clientId, setClientId] = useState('');
  const [source, setSource] = useState('EFFECTIVE');
  const [policyId, setPolicyId] = useState('');
  const [version, setVersion] = useState('1');
  const [action, setAction] = useState('mqtt:Publish');
  const [operationId, setOperationId] = useState('PROPERTY_REPORT');
  const [resourceType, setResourceType] = useState('mqtt-operation');
  const [resourceId, setResourceId] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [effective, setEffective] = useState<Page<Effective> | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  function clear() { setSnapshot(null); setSimulation(null); setEffective(null); setError(undefined); }
  async function run(cursor?: string) {
    if (!principalId.trim() || ((mode === 'snapshot' || principalType === 'DEVICE') && !productId.trim())) { setError(new Error('请填写主体 ID 和设备所属的产品 ID。')); return; }
    if ((mode === 'snapshot' || mode === 'simulation' && principalType === 'DEVICE') && !clientId.trim()) { setError(new Error('请填写实际 MQTT Client ID。')); return; }
    if (mode === 'simulation' && (!action.trim() || !resourceType.trim() || !resourceId.trim() || source !== 'EFFECTIVE' && !policyId.trim())) { setError(new Error('请补全模拟所需的策略、操作与资源。')); return; }
    setBusy(true); setError(undefined); setSnapshot(null); setSimulation(null);
    try {
      if (mode === 'snapshot') setSnapshot(await policyRequest<Snapshot>(projectId, 'mqtt-access-snapshots/preview', 'POST', { deviceId: principalId.trim(), productId: productId.trim(), clientId: clientId.trim() }));
      if (mode === 'effective') setEffective(await policyRequest<Page<Effective>>(projectId, 'effective-policies' + query({ principalType, principalId: principalId.trim(), productId: productId.trim(), cursor, pageSize: 20 })));
      if (mode === 'simulation') setSimulation(await policyRequest<Simulation>(projectId, 'authorization-decisions/simulation', 'POST', {
        sourceType: source, ...(source !== 'EFFECTIVE' ? { policyId: policyId.trim() } : {}), ...(source === 'VERSION' ? { versionNo: Number(version) } : {}),
        principal: { principalType, principalId: principalId.trim(), ...(principalType === 'DEVICE' ? { deviceId: principalId.trim(), productId: productId.trim(), clientId: clientId.trim() } : {}) },
        requests: [{ requestId: 'console-check', action: action.trim(), resourceType: resourceType.trim(), resourceId: resourceId.trim(), operationId: operationId.trim() || null, context: {} }],
      }));
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <div className="space-y-5"><div><h2 className="text-lg font-semibold">权限排查</h2><p className="mt-1 text-sm text-muted-foreground">查看后端计算的通道和策略来源，或模拟一次授权判断。查询不会修改权限。</p></div>
    <form onSubmit={e => { e.preventDefault(); void run(); }} onChange={clear} className="space-y-4 rounded-lg border p-4 sm:p-5">
      <fieldset disabled={busy} className="space-y-4">
        <Field title="排查方式"><select className={selectClass} value={mode} onChange={e => setMode(e.target.value)}><option value="snapshot">设备可以使用哪些 MQTT 通道</option><option value="effective">哪些自定义策略正在影响这个对象</option><option value="simulation">模拟一次操作是否允许</option></select></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {mode !== 'snapshot' && <Field title="主体类型"><select className={selectClass} value={principalType} onChange={e => setPrincipalType(e.target.value as PrincipalType)}>{Object.entries(principalLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>}
          <Field title={mode === 'snapshot' ? '设备 ID' : '主体 ID'}><Input value={principalId} onChange={e => setPrincipalId(e.target.value)} /></Field>
          {(mode === 'snapshot' || principalType === 'DEVICE') && <Field title="产品 ID"><Input value={productId} onChange={e => setProductId(e.target.value)} /></Field>}
          {(mode === 'snapshot' || mode === 'simulation' && principalType === 'DEVICE') && <Field title="MQTT Client ID"><Input value={clientId} onChange={e => setClientId(e.target.value)} /></Field>}
        </div>
        {mode === 'simulation' && <><div className="grid gap-4 sm:grid-cols-2"><Field title="规则来源"><select className={selectClass} value={source} onChange={e => setSource(e.target.value)}><option value="EFFECTIVE">当前实际授权（设备含标准通道）</option><option value="DRAFT">仅指定策略的草稿</option><option value="VERSION">仅指定策略的历史版本</option></select></Field>{source !== 'EFFECTIVE' && <Field title="策略 ID"><Input value={policyId} onChange={e => setPolicyId(e.target.value)} /></Field>}{source === 'VERSION' && <Field title="版本号"><Input type="number" min={1} value={version} onChange={e => setVersion(e.target.value)} /></Field>}<Field title="操作 Action"><Input value={action} onChange={e => setAction(e.target.value)} /></Field><Field title="资源类型"><Input value={resourceType} onChange={e => setResourceType(e.target.value)} /></Field><Field title="资源 ID"><Input value={resourceId} onChange={e => setResourceId(e.target.value)} /></Field><Field title="通信操作标识（非通信操作可留空）"><Input value={operationId} onChange={e => setOperationId(e.target.value)} /></Field></div><p className="text-xs text-muted-foreground">草稿 / 历史版本模拟仅检查指定文档，不能代表设备最终获得的全部权限。</p></>}
      </fieldset>
      <Failure error={error} /><Button type="submit" disabled={busy}><Search className="size-4" />{busy ? '查询中…' : '查询授权结果'}</Button>
    </form>
    {snapshot && <div className="space-y-4" aria-live="polite"><div className="rounded-lg bg-muted/40 p-4"><h3 className="font-medium">{snapshot.allowedConnect ? '策略允许连接' : '策略不允许连接'}</h3><p className="mt-1 text-xs text-muted-foreground">{snapshot.decisionCode} · 求值于 {formatTime(snapshot.evaluatedAt)}</p><p className="mt-2 text-sm">这是授权预览，不代表设备认证通过、在线或 Broker 已应用该结果。</p></div>{snapshot.warnings?.map(w => <p className="text-sm text-amber-700 dark:text-amber-400" key={w}>{w}</p>)}<GatewayDataTable rows={snapshot.rules ?? []} columns={[{ label: '设备操作', render: r => r.action === 'PUBLISH' ? '发布' : '订阅' }, { label: 'Topic', render: r => <code className="block max-w-xl break-all text-xs">{r.topic}</code> }, { label: 'QoS', render: r => r.qos?.join(' / ') }, { label: 'Retain', render: r => r.retain ? '允许' : '不允许' }]} /><p className="break-all text-sm text-muted-foreground">绑定来源：{snapshot.bindingSources?.join('、') || '无自定义绑定；标准通道由平台内置提供。'}</p></div>}
    {effective && !error && <div className="space-y-3"><p className="text-sm text-muted-foreground">这里只列出自定义策略。没有记录不代表设备没有标准通信权限。</p><GatewayDataTable rows={effective.items} columns={[{ label: '策略', render: r => <div>{r.policyName}<p className="text-xs text-muted-foreground">{r.policyId}</p></div> }, { label: '版本', render: r => 'v' + r.policyVersionNo }, { label: '授权来源', render: r => <div>{principalLabels[r.bindingSourceType as PrincipalType] ?? r.bindingSourceType}<p className="break-all text-xs">{r.bindingSourceId}</p></div> }, { label: '到期时间', render: r => r.expiresAt ? formatTime(r.expiresAt) : '长期有效' }]} />{effective.hasMore && effective.nextCursor && <Button variant="outline" disabled={busy} onClick={() => void run(effective.nextCursor!)}>下一页</Button>}</div>}
    {simulation && <div className="space-y-3" aria-live="polite">{simulation.results.map((result, index) => <div key={index} className="space-y-2 rounded-lg border p-5"><h3 className="font-medium">{result.allowed ? '允许此操作' : '不允许此操作'}</h3><p className="text-xs text-muted-foreground">{result.decisionCode}</p><p className="text-sm">命中允许：{result.matchedAllows?.join('、') || '无'}</p><p className="text-sm">命中禁止：{result.matchedDenies?.join('、') || '无'}</p>{result.missingRequirements?.map(x => <p className="text-sm text-destructive" key={x}>{x}</p>)}</div>)}</div>}
  </div>;
}
