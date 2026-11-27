import { useState } from 'react';
import { ClipboardCheck, FlaskConical, History, ListChecks, Rocket } from 'lucide-react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime } from '@/lib/date-time';
import {
  pagePath,
  ruleRequest,
  type Decision,
  type Execution,
  type Page,
  type Rule,
  type SimulationStep,
  type Version,
} from '@/api/rule-engine/client';
import { parseObject, portLabels } from './graph';
import samples from './examples/pump-simulation.json';

type Tab = 'validate' | 'simulate' | 'versions' | 'history';
type Issue = { path: string; message: string; code: string };

export function RunPanel({
  projectId,
  rule,
  dirty,
  onActivation,
  onTrace,
}: {
  projectId: string;
  rule: Rule;
  dirty: boolean;
  onActivation: (generation: number, version: string, enabled: boolean) => void;
  onTrace: (decision?: Decision) => void;
}) {
  const [tab, setTab] = useState<Tab>('validate');
  const [issues, setIssues] = useState<Issue[]>();
  const [timeline, setTimeline] = useState(JSON.stringify(samples, null, 2));
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [device, setDevice] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [cursor, setCursor] = useState('');
  const [versionCursor, setVersionCursor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = encodeURIComponent(rule.ruleId);
  const versionsPath = pagePath('rules/' + id + '/versions', versionCursor);
  const versions = useSWR(tab === 'versions' ? [projectId, versionsPath] : null, () =>
    ruleRequest<Page<Version>>(projectId, versionsPath),
  );
  const historyPath = pagePath('executions', cursor, {
    ruleId: rule.ruleId,
    ...(deviceFilter ? { deviceId: deviceFilter } : {}),
  });
  const history = useSWR(tab === 'history' ? [projectId, historyPath] : null, () =>
    ruleRequest<Page<Execution>>(projectId, historyPath),
  );
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  async function activate(version: string, enabled: boolean) {
    const result = await ruleRequest<{ generation: number }>(
      projectId,
      'rules/' + id + '/activation',
      'PUT',
      {
        enabled,
        versionId: version,
        expectedGeneration: rule.generation,
        inFlightPolicy: 'DRAIN',
      },
    );
    onActivation(result.generation, version, enabled);
  }
  const publishedDraft = versions.data?.items.some((v) => v.draftRevision === rule.draftRevision);
  return (
    <section className="rule-surface min-w-0 px-4 py-3" aria-label="调试与运行">
      <Tabs
        className="grid min-w-0"
        value={tab}
        onValueChange={(value) => {
          setTab(value as Tab);
          setError('');
          onTrace();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ListChecks size={17} className="text-(--rule-accent)" />
            调试与运行
          </h3>
          <TabsList variant="line" aria-label="调试与运行" className="max-w-full">
            {(
              [
                ['validate', '校验', ClipboardCheck],
                ['simulate', '样本试算', FlaskConical],
                ['versions', '发布与启停', Rocket],
                ['history', '运行记录', History],
              ] as const
            ).map(([key, label, Icon]) => (
              <TabsTrigger key={key} value={key} disabled={busy}>
                <Icon className="hidden md:block" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {tab !== 'history' && dirty && (
          <p className="text-sm text-muted-foreground">请先保存草稿。</p>
        )}
        {tab === 'validate' && (
          <TabsContent value="validate" className="space-y-2 py-2">
            <Button
              disabled={dirty || busy}
              onClick={() =>
                void run(async () => {
                  const result = await ruleRequest<{ issues: Issue[] }>(
                    projectId,
                    'rules/' + id + '/validations',
                    'POST',
                  );
                  setIssues(result.issues);
                })
              }
            >
              校验草稿
            </Button>
            {issues && !dirty && (
              <div className="text-sm" role="status">
                {issues.length
                  ? issues.map((issue, i) => (
                      <p key={i}>
                        {issue.path} · {issue.message}
                      </p>
                    ))
                  : '校验通过'}
              </div>
            )}
          </TabsContent>
        )}
        {tab === 'simulate' && (
          <TabsContent value="simulate" className="space-y-3 py-2">
            <label className="grid gap-1 text-sm">
              设备与样本时间线（JSON）
              <Textarea
                className="h-36 font-mono text-xs"
                value={timeline}
                onChange={(e) => {
                  setTimeline(e.target.value);
                  setSteps([]);
                  onTrace();
                }}
              />
            </label>
            <Button
              disabled={dirty || busy}
              onClick={() =>
                void run(async () => {
                  setSteps([]);
                  onTrace();
                  const result = await ruleRequest<{ steps: SimulationStep[] }>(
                    projectId,
                    'simulations',
                    'POST',
                    { ...parseObject(timeline), ruleId: rule.ruleId },
                  );
                  setSteps(result.steps);
                })
              }
            >
              运行试算
            </Button>
            {!dirty &&
              steps.map((step, i) => (
                <button
                  key={i}
                  className="block w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => onTrace(step.decision)}
                >
                  {formatDateTime(step.time)} · {step.deadline ? '到期检查' : '设备样本'} ·{' '}
                  {step.decision.condition?.reason ?? step.decision.condition?.type} ·{' '}
                  {step.plans.length} 个动作
                </button>
              ))}
          </TabsContent>
        )}
        {tab === 'versions' && (
          <TabsContent value="versions" className="space-y-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={busy || dirty || publishedDraft}
                onClick={() =>
                  void run(async () => {
                    await ruleRequest(projectId, 'rules/' + id + '/versions', 'POST', {
                      expectedRevision: rule.draftRevision,
                    });
                    setVersionCursor('');
                    await versions.mutate();
                  })
                }
              >
                发布草稿修订 {rule.draftRevision}
              </Button>
              {rule.status === 'ENABLED' && rule.activeVersionId && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(() => activate(rule.activeVersionId!, false))}
                >
                  停用规则
                </Button>
              )}
            </div>
            {versions.isLoading && <p>正在加载版本…</p>}
            {versions.error && <p role="alert">{versions.error.message}</p>}
            {versions.data?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">还没有已发布版本。</p>
            )}
            {versions.data?.items.map((v) => (
              <div
                key={v.versionId}
                className="flex items-center justify-between gap-2 border-t py-2 text-sm"
              >
                <span>
                  版本 {v.versionNumber} · 草稿修订 {v.draftRevision}
                </span>
                {rule.activeVersionId === v.versionId && rule.status === 'ENABLED' ? (
                  <span>当前生效</span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || dirty}
                    onClick={() => void run(() => activate(v.versionId, true))}
                  >
                    启用此版本
                  </Button>
                )}
              </div>
            ))}
            <Pager
              cursor={versionCursor}
              next={versions.data?.nextCursor}
              onChange={setVersionCursor}
            />
          </TabsContent>
        )}
        {tab === 'history' && (
          <TabsContent value="history" className="space-y-2 py-2">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const nextFilter = device.trim();
                if (nextFilter === deviceFilter && !cursor) {
                  void history.mutate();
                } else {
                  setDeviceFilter(nextFilter);
                  setCursor('');
                }
              }}
            >
              <Input
                aria-label="设备编号"
                placeholder="按设备编号筛选"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
              />
              <Button variant="outline">查询记录</Button>
            </form>
            {history.isLoading && <p>正在加载执行记录…</p>}
            {history.error && <p role="alert">{history.error.message}</p>}
            {history.data?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">当前条件下没有执行记录。</p>
            )}
            {history.data?.items.map((row) => (
              <details key={row.executionId} className="rounded border p-2 text-sm">
                <summary>
                  {formatDateTime(row.occurredAt)} ·{' '}
                  {row.decision.condition?.reason ?? row.decision.condition?.type}
                </summary>
                <p className="mt-2 break-all text-muted-foreground">
                  执行 {row.executionId} · 版本 {row.versionId}
                </p>
                <ol className="mt-2 space-y-1">
                  {row.decision.path.map((visit, i) => (
                    <li key={i}>
                      {visit.nodeId}
                      {visit.port && ' → ' + (portLabels[visit.port] ?? visit.port)}
                    </li>
                  ))}
                </ol>
              </details>
            ))}
            <Pager cursor={cursor} next={history.data?.nextCursor} onChange={setCursor} />
          </TabsContent>
        )}
      </Tabs>
    </section>
  );
}

export function Pager({
  cursor,
  next,
  onChange,
}: {
  cursor: string;
  next?: string | null;
  onChange: (cursor: string) => void;
}) {
  return cursor || next ? (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={!cursor} onClick={() => onChange('')}>
        首页
      </Button>
      <Button size="sm" variant="outline" disabled={!next} onClick={() => next && onChange(next)}>
        下一页
      </Button>
    </div>
  ) : null;
}
