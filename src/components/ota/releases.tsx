import { Pager } from '@/components/policy/shared';
import { by, manualRefreshOptions, useAction, usePage } from './hooks';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Plus, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeviceTable } from '@/components/device/layout';
import { usePermission } from '@/context/iam-context/identity';
import { formatDateTime } from '@/lib/date-time';
import { cn } from '@/lib/utils';
import { request } from '@/api/iam/client';
import { otaRequest, type Configuration, type Release, type ReleaseTarget, type Statistics } from '@/api/ota/client';
import type { ProductDetailView } from '@/types/apps/open-platform';
import { Choice, Failure, Field, Help, Input, Loading, Modal, Status } from './shared';
import ReleaseWizard from './release-wizard';
import Tasks from './tasks';
import { taskStatusGroups, type TaskStatus } from './task-filters';

function emptyTaskMessage(config: Configuration, stats?: Statistics) {
  if (config.state === 'DRAFT') return '激活批次后开始匹配设备，通过升级条件的设备会出现在这里。';
  if (!stats || stats.createdTaskCount !== 0) return '当前页没有设备任务。';
  if (stats.candidateCount === 0) return '尚未匹配到候选设备。';
  if (stats.ineligibleCount === stats.candidateCount) {
    return `已匹配 ${stats.candidateCount} 台候选设备，均未通过本次升级条件，已创建 0 个任务。`;
  }
  if (stats.pendingCount > 0) return `还有 ${stats.pendingCount} 台候选设备待判断，当前已创建 0 个任务。`;
  return '本批次尚未创建设备任务。';
}

function ReleaseDetail({
  projectId,
  id,
  back,
}: {
  projectId: string;
  id: string;
  back: () => void;
}) {
  const { mutate } = useSWRConfig();
  const configuration = useSWR(
    [projectId, 'ota-configuration', id],
    () => otaRequest<Configuration>(projectId, `releases/${id}/configuration`),
    manualRefreshOptions,
  );
  const stats = useSWR(
    [projectId, 'ota-statistics', id],
    () => otaRequest<Statistics>(projectId, `monitor/releases/${id}`),
    manualRefreshOptions,
  );
  const action = useAction();
  const update = usePermission('ota:update');
  const [operation, setOperation] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [listView, setListView] = useState('tasks');
  const targetPath = `releases/${id}/targets`;
  const targets = usePage<ReleaseTarget>(projectId, listView === 'devices' ? targetPath : null, 0, manualRefreshOptions);
  const listSwitcher = (
    <Select value={listView} onValueChange={(view) => { if (view) setListView(view); }}>
      <SelectTrigger aria-label="批次列表视图" className="w-28">
        <SelectValue>{listView === 'tasks' ? '设备任务' : '匹配设备'}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="min-w-0! w-(--anchor-width)! rounded-md!">
        <SelectItem value="tasks">设备任务</SelectItem>
        <SelectItem value="devices">匹配设备</SelectItem>
      </SelectContent>
    </Select>
  );
  const [taskStates, setTaskStates] = useState<TaskStatus[]>([]);
  const [percent, setPercent] = useState(100);
  const [rate, setRate] = useState(20);
  const config = configuration.data;
  const labels: Record<string, string> = {
    activate: '激活批次',
    pause: '暂停批次',
    resume: '恢复批次',
    stop: '停止批次',
    rollout: '扩大灰度',
    'push-rate': '调整速率',
  };
  function refreshDetail() {
    const taskPages = mutate((key) => {
      if (!Array.isArray(key) || key[0] !== projectId || key[1] !== 'ota') return false;
      const path = key[2];
      if (typeof path === 'string' && path.startsWith(targetPath + '?')) return true;
      if (typeof path !== 'string' || !path.startsWith('tasks?')) return false;
      const query = new URLSearchParams(path.slice('tasks?'.length));
      return query.get('sourceType') === 'RELEASE' && query.get('sourceId') === id;
    });
    return Promise.all([configuration.mutate(), stats.mutate(), taskPages]);
  }
  async function submit() {
    await action.run(async () => {
      if (
        operation === 'rollout' &&
        (!Number.isInteger(percent) || percent < (config?.rolloutPercent ?? 0) || percent > 100)
      )
        throw new Error('新比例不能低于当前比例且不得超过 100%。');
      if (operation === 'push-rate' && (!Number.isInteger(rate) || rate <= 0))
        throw new Error('请输入正整数速率。');
      const updated = await otaRequest<Release>(
        projectId,
        `releases/${id}/${operation === 'rollout' ? `rollout/${percent}` : operation}`,
        operation === 'push-rate' ? 'PUT' : 'POST',
        operation === 'push-rate' ? { pushPerMinute: rate, rateMode: 'CONSTANT' } : undefined,
      );
      await configuration.mutate(
        (current) =>
          current
            ? { ...current, state: updated.state, activeRevisionNo: updated.activeRevisionNo }
            : current,
        {
          revalidate: false,
        },
      );
      await mutate(
        (key) =>
          Array.isArray(key) &&
          key[0] === projectId &&
          key[1] === 'ota' &&
          typeof key[2] === 'string' &&
          /^releases(?:\?|$)/.test(key[2]),
        undefined,
        { revalidate: false },
      );
      setOperation('');
      await refreshDetail();
    }, '批次已更新');
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={back}>
            <ArrowLeft className="size-4" />
            返回批次列表
          </Button>
          {config && (
            <div className="flex min-w-0 items-center gap-2 border-l pl-3">
              <code className="break-all text-xs text-muted-foreground" title={id}>{id}</code>
              <Status value={config.state} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {config && (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <SlidersHorizontal className="size-4" />
              批次配置
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshDetail()}
          >
            <RefreshCw className="size-4" />
            刷新
          </Button>
          {config && update && (
            <div className="flex flex-wrap gap-2">
              {(config.state === 'DRAFT'
                ? ['activate']
                : config.state === 'ACTIVE'
                  ? ['pause', 'rollout', 'push-rate', 'stop']
                  : config.state === 'PAUSED'
                    ? ['resume', 'rollout', 'push-rate', 'stop']
                    : []
              ).map((op) => (
                <Button
                  key={op}
                  variant={op === 'activate' ? 'default' : 'outline'}
                  className={op === 'stop' ? 'text-destructive' : undefined}
                  size="sm"
                  disabled={action.busy}
                  onClick={() => {
                    setOperation(op);
                    setPercent(config.rolloutPercent);
                    setRate(config.pushPerMinute);
                    action.setError(undefined);
                  }}
                >
                  {labels[op]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
      <Failure error={configuration.error} retry={() => configuration.mutate()} />
      {!config ? (
        configuration.isLoading ? (
          <Loading />
        ) : null
      ) : (
        <>
          <Failure error={stats.error} retry={() => stats.mutate()} />
          {listView === 'devices' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([['candidateCount', '匹配设备总数'], ['pendingCount', '待校验'], ['ineligibleCount', '未通过校验']] as const).map(([key, label]) => (
                <div key={key} className="rounded-lg border px-4 py-3">
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className={cn('mt-2 block text-2xl font-semibold tabular-nums', key === 'ineligibleCount' && 'text-red-700 dark:text-red-400')}>
                    {stats.data?.[key] ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {(
              [
                ['createdTaskCount', '已建任务', []],
                ['successCount', '成功', ['SUCCEEDED']],
                ['runningCount', '执行中', ['RUNNING']],
                ['waitingCount', '等待', taskStatusGroups.waiting],
                ['failedCount', '失败', taskStatusGroups.failed],
              ] as const
            ).map(([key, label, states]: readonly [keyof Statistics, string, readonly TaskStatus[]]) => {
              const selected = taskStates.length === states.length
                && states.every((state) => taskStates.includes(state));
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTaskStates([...states])}
                  className={cn(
                    'cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    selected && 'border-ring/60 bg-muted/35',
                  )}
                >
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className={cn(
                    'mt-2 block text-2xl font-semibold tabular-nums',
                    key === 'successCount' && 'text-emerald-700 dark:text-emerald-400',
                    key === 'failedCount' && 'text-red-700 dark:text-red-400',
                  )}>
                    {stats.data?.[key] ?? '—'}
                  </span>
                </button>
              );
            })}
          </div>
          )}
          {listView === 'tasks' ? (
              <Tasks
                listSwitcher={listSwitcher}
                projectId={projectId}
                sourceType="RELEASE"
                sourceId={id}
                requireAppConfirm={config.requireAppConfirm}
                stateFilter={{ value: taskStates, onChange: setTaskStates }}
                emptyMessage={emptyTaskMessage(config, stats.error ? undefined : stats.data)}
                onTasksRefresh={stats.mutate}
              />
          ) : (
            <section aria-label="匹配设备" className="min-w-0 flex-1 overflow-hidden rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between px-4 py-3">
                {listSwitcher}
                <Button size="sm" variant="outline" disabled={targets.isValidating}
                  onClick={() => void Promise.all([targets.mutate(), stats.mutate()])}>
                  <RefreshCw className="size-4" />刷新
                </Button>
              </div>
              {targets.error ? <Failure error={targets.error} retry={() => targets.mutate()} />
                : targets.isLoading ? <Loading /> : (
                  <DeviceTable embedded rows={targets.rows} emptyMessage="该批次尚无匹配设备。" columns={[
                    { label: '设备 ID', render: (row) => <code className="text-xs">{row.deviceId}</code> },
                    { label: '校验结果', render: (row) => <Badge variant="outline" className={cn(
                      'h-6 rounded-md px-2',
                      row.matchState === 'INELIGIBLE' && 'border-destructive/30! bg-destructive/10! text-destructive!',
                      row.matchState === 'PENDING' && 'border-amber-500/25! bg-amber-500/10! text-amber-800! dark:text-amber-300!',
                      row.matchState === 'TASK_CREATED' && 'border-emerald-500/25! bg-emerald-500/10! text-emerald-700! dark:text-emerald-400!',
                    )}>
                      {{ PENDING: '待校验', INELIGIBLE: '未通过校验', TASK_CREATED: '已创建任务' }[row.matchState]}
                    </Badge> },
                    { label: '未通过原因', render: (row) => row.matchState === 'INELIGIBLE'
                      ? <span className="block min-w-36 max-w-64 whitespace-normal">{row.matchReason || '暂无校验原因记录'}</span>
                      : '—' },
                    { label: '规则修订', render: (row) => row.matchedRevisionNo ?? '—' },
                    { label: '灰度分桶', render: (row) => row.bucketNo },
                    { label: '登记时间', render: (row) => formatDateTime(row.createTime) },
                    { label: '更新时间', render: (row) => formatDateTime(row.updateTime) },
                  ]} />
                )}
              {(targets.hasPrevious || targets.data?.hasMore) && <div className="p-3"><Pager {...targets.pagerProps} /></div>}
            </section>
          )}
        </>
      )}
      {config && (
        <Modal
          title="批次配置"
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          footer={
            <>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    to={`/projects/${projectId}/ota?section=firmware&product=${config.productId}&module=${config.moduleId}&version=${config.targetVersionId}&package=${config.packageId}`}
                  />
                }
              >
                查看升级包
              </Button>
              <Button type="button" onClick={() => setConfigOpen(false)}>关闭</Button>
            </>
          }
        >
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ['目标版本', config.targetVersionId],
              ['升级包', config.packageId],
              ['灰度比例', `${config.rolloutPercent}%`],
              ['推送速率', `${config.pushPerMinute} 台/分钟`],
              ['匹配方式', config.mode === 'STATIC' ? '仅本次设备' : '持续匹配'],
              ['源版本', config.sourceVersions?.join('、') || '不限制'],
              ['硬件版本', config.hardwareVersions?.join('、') || '不限制'],
              ['指定设备', config.deviceIds?.join('、') || '不限制'],
              ['设备组', config.groupId || '不限制'],
              [
                '标签',
                Object.entries(config.tags ?? {})
                  .map(([k, v]) => `${k}=${v}`)
                  .join('、') || '不限制',
              ],
              ['业务确认', config.requireAppConfirm ? '需要' : '不需要'],
              [
                '开始时间',
                config.effectiveFrom ? formatDateTime(config.effectiveFrom) : '激活后立即',
              ],
              [
                '截止时间',
                config.effectiveUntil ? formatDateTime(config.effectiveUntil) : '不限制',
              ],
              ['设备执行时间', config.execTime ? formatDateTime(config.execTime) : '立即'],
              ['优先级', String(config.priority)],
              [
                '速率模式',
                config.rateMode === 'PROGRESSIVE'
                  ? `每成功 ${config.rateThreshold} 台增加 ${config.rateStep}，上限 ${config.maxPushPerMinute}`
                  : '固定',
              ],
              ['规则修订', String(config.activeRevisionNo)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
                <dd className="[overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      <Modal
        title={labels[operation] ?? '批次操作'}
        open={!!operation}
        onClose={() => setOperation('')}
        busy={action.busy}
        footer={
          <>
            <Button variant="outline" disabled={action.busy} onClick={() => setOperation('')}>
              返回
            </Button>
            <Button
              variant={operation === 'stop' ? 'destructive' : 'default'}
              disabled={action.busy}
              onClick={() => void submit()}
            >
              {action.busy ? '提交中…' : '确认' + (labels[operation] ?? '')}
            </Button>
          </>
        }
      >
        {operation === 'rollout' ? (
          <Field title="新的灰度比例（%）">
            <Input
              aria-label="新的灰度比例"
              type="number"
              min={config?.rolloutPercent ?? 0}
              max={100}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            />
          </Field>
        ) : operation === 'push-rate' ? (
          <Field
            title="固定推送速率（台/分钟）"
            help="确认后切换为固定速率，影响后续尚未下发的任务。"
          >
            <Input
              aria-label="新的固定速率"
              type="number"
              min={1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </Field>
        ) : (
          <p className="text-sm leading-6">
            {operation === 'activate'
              ? '激活后，云端先登记候选设备，再在批次有效期内判断升级条件。通过判断的设备会生成升级任务。'
              : operation === 'stop'
                ? '停止后不再匹配设备或下发新任务，此批次不能恢复。已经下发的设备仍可能继续执行，执行结果可以继续查看。'
                : operation === 'pause'
                  ? '暂停后停止后续任务下发，已经下发的设备可能继续执行。'
                  : '恢复后，云端继续按当前策略处理待下发任务。'}
          </p>
        )}
        <Failure error={action.error} />
      </Modal>
    </div>
  );
}
export default function Releases({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const productId = params.get('product') ?? '';
  const id = params.get('release');
  const [state, setState] = useState('');
  const [create, setCreate] = useState(false);
  const allowed = usePermission('ota:create');
  const page = usePage<Release>(projectId, id ? null : by('releases', { productId, state }));
  const { data: product } = useSWR(
    productId && !id ? [projectId, 'ota-product', productId] : null,
    () =>
      request<ProductDetailView>(`/api/v1/products/${encodeURIComponent(productId)}`, 'GET', undefined, {
        projectId,
      }),
  );
  const productName = product?.productName ?? '当前产品';
  if (id)
    return (
      <ReleaseDetail
        key={id}
        projectId={projectId}
        id={id}
        back={() => setParams(productId ? { product: productId } : {})}
      />
    );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 className="text-lg font-semibold">OTA 升级批次</h2>
          <Help label="升级批次">
            先在「固件管理」中完成升级包封存与样机验证，再创建升级批次。批次创建为草稿，激活后开始按配置匹配设备。
          </Help>
        </div>
        {allowed && (
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            新建升级批次
          </Button>
        )}
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-36">
            <Choice
              label="批次状态"
              value={state}
              onValueChange={setState}
              options={[
                { value: '', label: '全部状态' },
                { value: 'DRAFT', label: '草稿' },
                { value: 'ACTIVE', label: '已激活' },
                { value: 'PAUSED', label: '已暂停' },
                { value: 'STOPPED', label: '已停止' },
              ]}
            />
          </div>
          {productId && (
            <Button
              size="sm"
              variant="secondary"
              className="max-w-full min-w-0"
              aria-label={`清除产品筛选：${productName}`}
              title={`清除产品筛选：${productName}`}
              onClick={() =>
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.delete('product');
                  return next;
                })
              }
            >
              <span className="truncate">产品筛选：{productName}</span>
              <X className="size-3.5 shrink-0" />
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={page.isValidating}
          onClick={() => void page.mutate()}
        >
          <RefreshCw className="size-4" />
          刷新
        </Button>
      </div>
      <Failure error={page.error} retry={() => page.mutate()} />
      {page.isLoading ? (
        <Loading />
      ) : (
        <DeviceTable
          rows={page.rows}
          columns={[
            {
              label: '目标固件',
              render: (r) => (
                <div className="space-y-1">
                  <div className="font-medium">
                    {r.moduleName ?? r.moduleId} · {r.targetVersionText ?? r.targetVersionId}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{r.id}</div>
                </div>
              ),
            },
            { label: '状态', render: (r) => <Status value={r.state} /> },
            { label: '匹配模式', render: (r) => (r.mode === 'STATIC' ? '仅本次设备' : '持续匹配') },
            {
              label: '开始时间',
              render: (r) => (r.effectiveFrom ? formatDateTime(r.effectiveFrom) : '激活后立即'),
            },
            {
              label: '创建时间',
              render: (r) => (r.createTime ? formatDateTime(r.createTime) : '—'),
            },
            {
              label: '操作',
              render: (r) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setParams({ ...(productId ? { product: productId } : {}), release: r.id })
                  }
                >
                  查看批次
                </Button>
              ),
            },
          ]}
        />
      )}
      <Pager {...page.pagerProps} />
      {create && (
        <ReleaseWizard
          projectId={projectId}
          productId={productId}
          onClose={() => setCreate(false)}
          onCreated={(release) => {
            setCreate(false);
            setParams({ release, ...(productId ? { product: productId } : {}) });
          }}
        />
      )}
    </div>
  );
}
