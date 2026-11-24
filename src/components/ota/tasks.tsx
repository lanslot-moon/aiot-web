import { Pager } from '@/components/policy/shared';
import { by, manualRefreshOptions, useAction, usePage } from './hooks';
import { useEffect, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { History, RefreshCw } from 'lucide-react';
import { dispatchResultLabel } from './task-dispatch-reasons';
import AttemptTimeline from './attempt-timeline';
import { verificationTableLayout } from './verification-table-layout';
import { taskStatusLabels, type TaskStatus } from './task-filters';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { DeviceTable } from '@/components/device/layout';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { usePermission } from '@/context/iam-context/identity';
import { cn } from '@/lib/utils';
import { otaRequest, type Task, type Attempt, type AttemptEventTimeline, type Page } from '@/api/ota/client';
import { Failure, Help, Loading, Modal, Status } from './shared';
const eligible: Record<string, string[]> = {
  confirm: ['WAIT_CONFIRM'],
  cancel: ['WAIT_CONFIRM', 'WAIT_DISPATCH', 'NOTIFIED'],
  retry: ['FAILED', 'TIMED_OUT', 'RETRY_WAIT'],
};
const labels: Record<string, string> = {
  confirm: '确认下发',
  cancel: '取消任务',
  retry: '重试任务',
};
function attemptRefreshInterval(data: Page<Attempt> | undefined) {
  return !data?.items.length || data.items.some((attempt) => attempt.finishedAt == null) ? 5000 : 0;
}

function VerificationTaskProgress({ task }: { task: Task }) {
  const completed = task.state === 'SUCCEEDED';
  const percent = completed ? 100 : task.progressPercent;
  const confirming = task.state === 'RUNNING' && percent === 100;
  if (percent == null || (percent === 100 && !completed && !confirming)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={`设备 ${task.deviceId} 的升级进度${confirming ? '，等待确认目标版本' : ''}`}
        aria-valuenow={confirming ? undefined : percent}
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700"
      >
        <div
          className={cn(
            'relative h-full rounded-full motion-safe:transition-[width]',
            completed ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-sky-500 dark:bg-sky-400',
          )}
          style={{ width: `${percent}%` }}
        >
          {confirming && (
            <span className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/60 to-transparent motion-safe:animate-ota-confirm motion-reduce:hidden" />
          )}
        </div>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          'w-20 shrink-0 whitespace-nowrap text-right text-sm font-medium tabular-nums',
          confirming && 'text-xs',
          completed ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
        )}
      >
        {confirming ? '等待版本确认' : `${percent}%`}
      </span>
    </div>
  );
}

function verificationTaskNote(task: Task) {
  if (task.state === 'SUCCEEDED') return '目标版本已确认';
  if (task.state === 'WAIT_DISPATCH' && task.dispatchReasonCode) {
    return dispatchResultLabel(task.dispatchReasonCode);
  }
  if (task.lastErrorCode) return `错误码 ${task.lastErrorCode}`;

  switch (task.state) {
    case 'WAIT_CONFIRM': return '等待确认下发';
    case 'WAIT_DISPATCH': return '等待平台下发升级通知';
    case 'NOTIFIED': return '等待设备首次上报进度';
    case 'RUNNING':
      if (task.progressPercent === 100) return '等待设备上报目标版本';
      return task.progressPercent == null ? '等待设备上报进度' : '设备正在执行升级';
    case 'RETRY_WAIT': return '等待下一轮下发';
    case 'FAILED': return '验证失败，详情见执行记录';
    case 'TIMED_OUT': return '在规定时间内未完成验证';
    case 'CANCELED': return '任务已取消';
    default: return '—';
  }
}

function Attempts({ projectId, task, autoRefresh }: {
  projectId: string;
  task: Task;
  autoRefresh: boolean;
}) {
  const page = usePage<Attempt>(
    projectId,
    by('tasks/attempts', { taskId: task.id }),
    autoRefresh ? attemptRefreshInterval : 0,
    autoRefresh ? undefined : manualRefreshOptions,
  );
  const [selectedAttemptNo, setSelectedAttemptNo] = useState<number | null>();
  const activeAttemptNo = selectedAttemptNo === undefined ? task.attemptNo : selectedAttemptNo;
  const activeAttempt = page.rows.find((attempt) => attempt.attemptNo === activeAttemptNo);
  const eventsPath = activeAttempt && `tasks/${task.id}/attempts/${activeAttempt.attemptNo}/events`;
  const events = useSWR(
    eventsPath ? [projectId, 'ota', eventsPath] : null,
    () => otaRequest<AttemptEventTimeline>(projectId, eventsPath!),
    {
      refreshInterval: autoRefresh ? (timeline) => {
        if (activeAttempt?.finishedAt == null) return 5000;
        const expiry = Math.min(...(timeline?.events.map((event) => event.expiresAt) ?? []));
        return Number.isFinite(expiry) ? Math.max(5000, expiry - Date.now()) : 0;
      } : 0,
      ...(!autoRefresh && manualRefreshOptions),
      shouldRetryOnError: false,
    },
  );
  return (
    <>
      <SheetHeader className="gap-2 pb-2 pt-3">
        <div className="flex items-center justify-between gap-3 pr-10">
          <SheetTitle>执行记录</SheetTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={page.isValidating || events.isValidating}
            onClick={() => void Promise.all([page.mutate(), events.mutate()])}
          >
            刷新记录
          </Button>
        </div>
        <SheetDescription className="space-y-1 break-all">
          <span className="block">{task.deviceId}</span>
          <span className="block">任务 ID {task.id}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-4">
        <Failure error={page.error} retry={() => page.mutate()} />
        {page.isLoading ? (
          <Loading />
        ) : (
          <AttemptTimeline
            attempts={page.rows}
            activeAttemptNo={activeAttemptNo}
            onToggle={(attemptNo) => setSelectedAttemptNo(activeAttemptNo === attemptNo ? null : attemptNo)}
            timeline={events.data}
            loading={events.isLoading}
            error={events.error}
            retry={() => events.mutate()}
          />
        )}
        {(page.data?.hasMore || page.hasPrevious) && <Pager {...page.pagerProps} />}
      </div>
    </>
  );
}
export default function Tasks({
  projectId,
  sourceType,
  sourceId,
  requireAppConfirm,
  toolbarActions,
  listSwitcher,
  stateFilter,
  emptyMessage,
  onTasksRefresh,
}: {
  projectId: string;
  sourceType: 'RELEASE' | 'VERIFICATION';
  sourceId: string;
  requireAppConfirm: boolean;
  listSwitcher?: ReactNode;
  toolbarActions?: ReactNode;
  emptyMessage?: string;
  onTasksRefresh?: () => Promise<unknown>;
  stateFilter?: { value: TaskStatus[]; onChange: (value: TaskStatus[]) => void };
}) {
  const [localStates, setLocalStates] = useState<TaskStatus[]>([]);
  const selectedStates = stateFilter?.value ?? localStates;
  const setStates = stateFilter?.onChange ?? setLocalStates;
  const state = [...selectedStates].sort().join(',');
  const filterLabel = selectedStates.map((value) => taskStatusLabels[value]).join('、') || '全部状态';
  const [previousState, setPreviousState] = useState(state);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Task>();
  const [operation, setOperation] = useState('');
  const isVerification = sourceType === 'VERIFICATION';
  const page = usePage<Task>(
    projectId,
    by('tasks', { sourceType, sourceId, state }),
    0,
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  if (state !== previousState) {
    setPreviousState(state);
    setSelected([]);
    page.resetPage();
  }
  const hasRunningVerification = isVerification && page.rows.some((task) => task.state === 'RUNNING');
  const { mutate: refreshTasks, isValidating } = page;
  useEffect(() => {
    if (!hasRunningVerification || isValidating) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void refreshTasks().catch(() => undefined);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasRunningVerification, isValidating, refreshTasks]);
  const action = useAction();
  const update = usePermission('ota:update');
  const current = page.rows.filter((t) => selected.includes(t.id));
  const allSelected = current.length > 0 && current.length === page.rows.length;
  const detailTask = page.rows.find((task) => task.id === detail?.id) ?? detail;
  function changePage(navigate?: () => void) {
    if (!navigate) return undefined;
    return () => {
      setSelected([]);
      navigate();
    };
  }
  function refreshList() {
    return Promise.all([page.mutate(), onTasksRefresh?.()]);
  }
  async function submit() {
    await action.run(async () => {
      await otaRequest(projectId, `tasks/batch/${operation}`, 'POST', {
        taskIds: current.map((t) => t.id),
      });
      setSelected([]);
      setOperation('');
      await refreshList();
    }, '任务操作已提交');
  }
  return (
    <section
      aria-label="设备任务"
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-lg border bg-muted/30',
        isVerification ? 'w-full shrink-0' : 'flex-1',
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {listSwitcher ?? <h3 className="text-sm font-semibold">设备任务</h3>}
            <Help label="任务进度">
              {isVerification ? '设备上报进度 100% 后显示「等待版本确认」，平台确认目标版本后显示 100%。' : '设备上报进度 100% 后，仍需等待目标版本确认。'}
              重试会保留原任务和每轮执行结果。仅对当前页选中的任务执行操作。
            </Help>
          </div>
          <div className="flex items-center gap-1.5">
            <Select<TaskStatus, true> multiple value={selectedStates} onValueChange={setStates}>
              <SelectTrigger aria-label="任务状态" className="w-40" title={filterLabel}>
                <SelectValue><span className="truncate">{filterLabel}</span></SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="rounded-md!">
                {Object.entries(taskStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStates.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setStates([])}>
                清除筛选
              </Button>
            )}
          </div>
          {sourceType === 'VERIFICATION' && (
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              验证批次 {sourceId}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {update &&
            Object.keys(labels).filter((op) => op !== 'confirm' || requireAppConfirm).map((op) => (
              <Button
                key={op}
                variant="outline"
                size="sm"
                disabled={
                  action.busy ||
                  !current.length ||
                  !current.every((t) => eligible[op].includes(t.state))
                }
                onClick={() => {
                  action.setError(undefined);
                  setOperation(op);
                }}
              >
                {labels[op]}
                {current.length ? ` (${current.length})` : ''}
              </Button>
            ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page.isValidating || action.busy}
            onClick={() => void refreshList()}
          >
            <RefreshCw className="size-4" />
            {page.isValidating ? '刷新中…' : '刷新'}
          </Button>
          {toolbarActions}
        </div>
      </div>
      {page.error && (
        <div className="px-4 pb-3">
          <Failure error={page.error} retry={() => page.mutate()} />
        </div>
      )}
      <div className={cn('relative', !isVerification && 'min-h-40 flex-1 bg-muted/45')}>
        <div className={cn(
          'max-h-96 overflow-auto [&_[data-slot=table-container]]:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-muted [&_tbody]:bg-card [&_tr]:border-0 [&_tbody_tr:nth-child(even)]:bg-muted/40 [&_tbody_tr:hover]:bg-muted/60 [&_td]:px-4 [&_th]:px-4 [&_th:first-child]:w-10 [&_th:first-child]:px-3 [&_td:first-child:not([colspan])]:px-3',
          isVerification
            ? cn(
                verificationTableLayout,
                'md:[&_td]:py-3 md:[&_th:first-child]:px-2! md:[&_td:first-child:not([colspan])]:px-2!',
                'max-md:[&_table]:block max-md:[&_thead]:sr-only max-md:[&_tbody]:block max-md:[&_tbody_tr]:grid max-md:[&_tbody_tr]:grid-cols-[1.25rem_minmax(0,1fr)_auto] max-md:[&_tbody_tr]:items-center max-md:[&_tbody_tr]:gap-x-2 max-md:[&_tbody_tr]:gap-y-2 max-md:[&_tbody_tr]:px-3 max-md:[&_tbody_tr]:py-3',
                'max-md:[&_tbody_td]:min-w-0 max-md:[&_tbody_td]:p-0! max-md:[&_tbody_td:nth-child(3)]:justify-self-end max-md:[&_tbody_td:nth-child(4)]:col-span-2 max-md:[&_tbody_td:nth-child(4)]:col-start-2 max-md:[&_tbody_td:nth-child(5)]:col-start-2 max-md:[&_tbody_td:last-child:not([colspan])]:justify-self-end max-md:[&_tbody_td[colspan]]:col-span-full',
              )
            : 'lg:absolute lg:inset-0 lg:max-h-none',
        )}>
          {page.isLoading ? (
            <Loading />
          ) : (
            <DeviceTable
              embedded
              rows={page.rows}
              emptyMessage={page.error ? '任务列表加载失败' : selectedStates.length ? '当前筛选条件下没有设备任务。' : emptyMessage}
              columns={[
                {
                  label: (
                    <Checkbox
                      aria-label="全选本页"
                      title="全选本页"
                      checked={allSelected}
                      indeterminate={current.length > 0 && !allSelected}
                      disabled={page.rows.length === 0 || action.busy}
                      onCheckedChange={(checked) =>
                        setSelected(checked ? page.rows.map((task) => task.id) : [])
                      }
                    />
                  ),
                  render: (r) => (
                    <Checkbox
                      aria-label={`选择任务 ${r.deviceId}`}
                      checked={selected.includes(r.id)}
                      disabled={action.busy}
                      onCheckedChange={(v) =>
                        setSelected((ids) => (v ? [...ids, r.id] : ids.filter((id) => id !== r.id)))
                      }
                    />
                  ),
                },
                {
                  label: '设备',
                  render: (r) => (
                    <div className={cn('items-center gap-1', isVerification ? 'flex min-w-0' : 'inline-flex')}>
                      <code className={cn('font-mono text-xs', isVerification && 'truncate')} title={r.deviceId}>
                        {r.deviceId}
                      </code>
                      <CopyIdButton value={r.deviceId} label="设备 ID" />
                    </div>
                  ),
                },
                { label: '状态', render: (r) => <Status value={r.state} /> },
                {
                  label: isVerification ? '升级进度' : '阶段 / 进度',
                  render: (r) =>
                    isVerification ? (
                      <VerificationTaskProgress task={r} />
                    ) : (
                      <span>
                        {r.phase ?? '—'}
                        {r.progressPercent != null ? ` · ${r.progressPercent}%` : ''}
                      </span>
                    ),
                },
                {
                  label: isVerification ? '执行说明' : '处理情况',
                  render: (r) => (
                    <span className={cn(
                      'block whitespace-normal text-xs leading-5 [overflow-wrap:anywhere]',
                      isVerification ? 'text-muted-foreground' : 'max-w-64',
                    )}>
                      {isVerification ? verificationTaskNote(r) : r.state === 'WAIT_DISPATCH'
                        ? r.dispatchReasonCode
                          ? dispatchResultLabel(r.dispatchReasonCode)
                          : '暂无近期下发诊断'
                        : r.lastErrorCode ?? '—'}
                    </span>
                  ),
                },
                {
                  label: '操作',
                  render: (r) => (
                    <Button size="sm" variant={isVerification ? 'ghost' : 'outline'} className={isVerification ? 'md:w-32 md:justify-start' : undefined} onClick={() => setDetail(r)}>
                      <History aria-hidden="true" />
                      执行记录
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
      {(page.data?.hasMore || page.hasPrevious) && (
        <div className="shrink-0 px-4 py-2">
          <Pager
            busy={page.pagerProps.busy || action.busy}
            previous={changePage(page.pagerProps.previous)}
            next={changePage(page.pagerProps.next)}
          />
        </div>
      )}
      <Modal
        title={labels[operation] ?? '任务操作'}
        open={!!operation}
        busy={action.busy}
        onClose={() => setOperation('')}
        footer={
          <>
            <Button variant="outline" disabled={action.busy} onClick={() => setOperation('')}>
              返回
            </Button>
            <Button disabled={action.busy || !current.length} onClick={() => void submit()}>
              {action.busy ? '提交中…' : '确认'}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          对选中的 {current.length} 台设备执行{labels[operation]}
          。服务端将重新检查所有任务的当前状态。
        </p>
        <Failure error={action.error} />
      </Modal>
      <Sheet
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(undefined);
        }}
      >
        <SheetContent className="w-full! max-w-lg! gap-2 overflow-y-auto">
          {detailTask && (
            <Attempts key={detailTask.id} projectId={projectId} task={detailTask} autoRefresh={isVerification} />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
