import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { DeviceTable, DetailField } from '@/components/device/layout';
import { otaRequest, type BuildAttempt } from '@/api/ota/client';
import { formatDateTime } from '@/lib/date-time';
import { Failure, Help, Loading, Status } from './shared';

function AttemptList({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [selectedId, setSelectedId] = useState<string>();
  const attempts = useSWR(
    [projectId, 'ota-build-attempts', taskId],
    () => otaRequest<BuildAttempt[]>(projectId, `delta-builds/${taskId}/attempts`),
    {
      shouldRetryOnError: false,
      refreshInterval: (data) => (data?.some((row) => row.status === 'RUNNING') ? 3000 : 0),
    },
  );
  const selected = attempts.data?.find((row) => row.id === selectedId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-sm">
          每轮执行
          <Help label="构建执行轮次">
            执行代次用于区分同一任务的每次领取。人工重试后，窗口内执行序号可能重新计数；历史记录仍保留。
          </Help>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={attempts.isValidating}
          onClick={() => void attempts.mutate()}
        >
          刷新记录
        </Button>
      </div>
      <Failure error={attempts.error} retry={() => attempts.mutate()} />
      {attempts.isLoading ? (
        <Loading />
      ) : (
        <DeviceTable
          rows={attempts.data ?? []}
          columns={[
            { label: '执行代次', render: (r) => <span>第 {r.leaseEpoch} 次</span> },
            { label: '结果', render: (r) => <Status value={r.status} /> },
            {
              label: '耗时',
              render: (r) =>
                r.durationMillis != null
                  ? `${(r.durationMillis / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} 秒`
                  : '—',
            },
            {
              label: '操作',
              render: (r) => (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={selectedId === r.id}
                  onClick={() => setSelectedId(r.id)}
                >
                  查看详情
                </Button>
              ),
            },
          ]}
        />
      )}
      {selected && (
        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">第 {selected.leaseEpoch} 次执行</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(undefined)}>
              收起详情
            </Button>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="窗口内执行序号">{String(selected.attemptNo)}</DetailField>
            <DetailField label="记录 ID">{selected.id}</DetailField>
            <DetailField label="开始时间">
              {selected.startedAt != null ? formatDateTime(selected.startedAt) : '—'}
            </DetailField>
            <DetailField label="结束时间">
              {selected.finishedAt != null ? formatDateTime(selected.finishedAt) : '—'}
            </DetailField>
            <DetailField label="退出码">
              {selected.exitCode == null ? '未返回' : String(selected.exitCode)}
            </DetailField>
            <DetailField label="命令超时">
              {selected.timedOut == null ? '—' : selected.timedOut ? '是' : '否'}
            </DetailField>
            <DetailField label="结果说明" fullWidth>
              {selected.msg || '—'}
            </DetailField>
          </dl>
        </section>
      )}
    </div>
  );
}
export default function BuildAttempts({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        构建执行记录
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full! overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>差分构建执行记录</SheetTitle>
            <SheetDescription className="break-all">任务 {taskId}</SheetDescription>
          </SheetHeader>
          <div className="min-w-0 p-4 sm:p-6">
            {open && <AttemptList key={taskId} projectId={projectId} taskId={taskId} />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
