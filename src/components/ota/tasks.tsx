import { Pager } from '@/components/policy/shared';
import { by, useAction, usePage } from './hooks';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { DeviceTable } from '@/components/device/layout';
import { formatDateTime } from '@/lib/date-time';
import { usePermission } from '@/context/iam-context/identity';
import { otaRequest, type Task, type Attempt } from '@/api/ota/client';
import { Choice, Failure, Help, Loading, Modal, Status } from './shared';
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
function Attempts({ projectId, task }: { projectId: string; task: Task }) {
  const page = usePage<Attempt>(projectId, by('tasks/attempts', { taskId: task.id }));
  return (
    <>
      <Failure error={page.error} retry={() => page.mutate()} />
      {page.isLoading ? (
        <Loading />
      ) : (
        <DeviceTable
          rows={page.rows}
          columns={[
            { label: '执行轮次', render: (r) => `第 ${r.attemptNo} 轮` },
            { label: '结果', render: (r) => <Status value={r.state} /> },
            { label: '开始时间', render: (r) => (r.startedAt ? formatDateTime(r.startedAt) : '—') },
            { label: '失败原因', render: (r) => r.failureCode ?? '—' },
          ]}
        />
      )}
      <Pager {...page.pagerProps} />
    </>
  );
}
export default function Tasks({
  projectId,
  sourceType,
  sourceId,
  toolbarActions,
}: {
  projectId: string;
  sourceType: 'RELEASE' | 'VERIFICATION';
  sourceId: string;
  toolbarActions?: ReactNode;
}) {
  const [state, setState] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Task>();
  const [operation, setOperation] = useState('');
  const page = usePage<Task>(projectId, by('tasks', { sourceType, sourceId, state }), 5000);
  const action = useAction();
  const update = usePermission('ota:update');
  const current = page.rows.filter((t) => selected.includes(t.id));
  async function submit() {
    await action.run(async () => {
      await otaRequest(projectId, `tasks/batch/${operation}`, 'POST', {
        taskIds: current.map((t) => t.id),
      });
      setSelected([]);
      setOperation('');
      await page.mutate();
    }, '任务操作已提交');
  }
  return (
    <section
      aria-label="设备任务"
      className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-muted/30"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold">设备任务</h3>
              <Help label="任务进度">
                进度 100%
                仍需等待设备上报目标版本。重试会保留原任务和每轮执行结果。仅对当前页选中的任务执行操作。
              </Help>
            </div>
            {sourceType === 'VERIFICATION' && (
              <p className="text-xs text-muted-foreground">验证批次 {sourceId}</p>
            )}
          </div>
          <div className="w-36">
            <Choice
              label="任务状态"
              value={state}
              onValueChange={(v) => {
                setState(v);
                setSelected([]);
              }}
              options={[
                { value: '', label: '全部状态' },
                ...[
                  'WAIT_CONFIRM',
                  'WAIT_DISPATCH',
                  'NOTIFIED',
                  'RUNNING',
                  'SUCCEEDED',
                  'FAILED',
                  'TIMED_OUT',
                  'RETRY_WAIT',
                  'CANCELED',
                ].map((value) => ({
                  value,
                  label: (
                    {
                      WAIT_CONFIRM: '待确认',
                      WAIT_DISPATCH: '等待下发',
                      NOTIFIED: '已通知',
                      RUNNING: '执行中',
                      SUCCEEDED: '成功',
                      FAILED: '失败',
                      TIMED_OUT: '超时',
                      RETRY_WAIT: '等待重试',
                      CANCELED: '取消',
                    } as Record<string, string>
                  )[value],
                })),
              ]}
            />
          </div>
        </div>
        {(update || toolbarActions) && (
          <div className="flex flex-wrap items-center gap-2">
            {update &&
              Object.keys(labels).map((op) => (
                <Button
                  key={op}
                  variant="outline"
                  size="sm"
                  disabled={
                    action.busy ||
                    !current.length ||
                    !current.every((t) => eligible[op].includes(t.state))
                  }
                  onClick={() => setOperation(op)}
                >
                  {labels[op]}
                  {current.length ? ` (${current.length})` : ''}
                </Button>
              ))}
            {toolbarActions}
          </div>
        )}
      </div>
      {page.error && (
        <div className="px-4 pb-3">
          <Failure error={page.error} retry={() => page.mutate()} />
        </div>
      )}
      <div className="relative min-h-40 flex-1 bg-muted/45">
        <div className="max-h-96 overflow-auto lg:absolute lg:inset-0 lg:max-h-none [&_[data-slot=table-container]]:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-muted [&_tbody]:bg-card [&_tr]:border-0 [&_tbody_tr:nth-child(even)]:bg-muted/40 [&_tbody_tr:hover]:bg-muted/60 [&_td]:px-4 [&_th]:px-4">
          {page.isLoading ? (
            <Loading />
          ) : (
            <DeviceTable
              embedded
              rows={page.rows}
              columns={[
                {
                  label: '选择',
                  render: (r) => (
                    <Checkbox
                      aria-label={`选择任务 ${r.deviceId}`}
                      checked={selected.includes(r.id)}
                      onCheckedChange={(v) =>
                        setSelected((ids) => (v ? [...ids, r.id] : ids.filter((id) => id !== r.id)))
                      }
                    />
                  ),
                },
                {
                  label: '设备',
                  render: (r) => <span className="font-mono text-xs">{r.deviceId}</span>,
                },
                { label: '状态', render: (r) => <Status value={r.state} /> },
                {
                  label: '阶段 / 进度',
                  render: (r) => (
                    <span>
                      {r.phase ?? '—'}
                      {r.progressPercent != null ? ` · ${r.progressPercent}%` : ''}
                    </span>
                  ),
                },
                { label: '失败原因', render: (r) => r.lastErrorCode ?? '—' },
                {
                  label: '操作',
                  render: (r) => (
                    <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
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
          <Pager {...page.pagerProps} />
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
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>执行记录</SheetTitle>
            <SheetDescription>{detail?.deviceId}</SheetDescription>
          </SheetHeader>
          <div className="p-6">
            {detail && <Attempts key={detail.id} projectId={projectId} task={detail} />}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
