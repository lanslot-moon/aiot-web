import { useRef, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { simulationRequest, previewInput, parseValueMap, decodeMap, type BehaviorPreview, type ProfileVersion } from '@/api/device/simulation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ErrorNotice } from '@/components/iam/shared';
import { Field, PolicySelect } from '@/components/policy/shared';
import { DeviceInput, DeviceSection } from '../layout';

export default function VersionPreview({ projectId, deviceId, version, parameters, initial }: { projectId: string; deviceId: string; version: ProfileVersion; parameters: string; initial: string }) {
  const [ruleIndex, setRuleIndex] = useState('0');
  const [args, setArgs] = useState('{}');
  const [elapsed, setElapsed] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [result, setResult] = useState<{ data: BehaviorPreview; fingerprint: string } | null>(null);
  const lock = useRef(false);
  const fingerprint = JSON.stringify([version.profileId, version.version, parameters, initial, ruleIndex, args, elapsed]);
  const rule = version.snapshot.rules[Number(ruleIndex)];
  async function preview() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      if (!rule) throw new Error('请选择要预演的规则。');
      const data = await simulationRequest<BehaviorPreview>(projectId, 'behavior-previews', 'POST', {
        profile: version.snapshot,
        instance: { instanceId: { value: 'configuration-preview' }, deviceId: { value: deviceId }, profileId: { value: version.profileId }, profileVersion: version.version, parameterOverrides: parseValueMap(parameters), initialOverrides: parseValueMap(initial) },
        input: previewInput(rule, args, Number(elapsed) * 1000),
      });
      setResult({ data, fingerprint });
    } catch (cause) { setError(cause); } finally { lock.current = false; setBusy(false); }
  }
  return <DeviceSection title="验证此设备的模拟行为" description="使用当前覆盖参数进行预演，不修改运行中的设备或发送消息。">
    <div className="grid gap-3 sm:grid-cols-2"><Field title="预演规则"><PolicySelect label="绑定版本预演规则" value={ruleIndex} disabled={busy} onValueChange={setRuleIndex} options={version.snapshot.rules.map((item, index) => ({ value: String(index), label: item.ruleId }))} /></Field><Field title="模拟已运行时间（秒）"><DeviceInput type="number" min={0} value={elapsed} disabled={busy} onChange={event => setElapsed(event.target.value)} /></Field></div>
    {rule && ['propertySet', 'serviceInvoke'].includes(rule.trigger.type) && <Field title="触发参数（JSON）"><Textarea value={args} disabled={busy} onChange={event => setArgs(event.target.value)} className="font-mono text-xs" /></Field>}
    <ErrorNotice error={error} /><Button variant="outline" disabled={busy || !rule} onClick={() => void preview()}><FlaskConical className="size-4" />{busy ? '预演中…' : '预演设备配置'}</Button>
    {result && <div role="status" className="space-y-2 rounded-lg border bg-muted/20 p-4"><p className="text-sm font-medium">{result.fingerprint === fingerprint ? '预演完成 · 尚未发送消息' : '输入已变化 · 此结果已过期'}</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(decodeMap(result.data.propertyChanges), null, 2)}</pre><details><summary className="cursor-pointer text-xs">查看 {result.data.effects.length} 个预计效果</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(result.data.effects, null, 2)}</pre></details></div>}
  </DeviceSection>;
}
