import type { Attempt, AttemptEventTimeline } from '@/api/ota/client';
import { formatDateTime } from '@/lib/date-time';
import { Failure, Loading, Status } from './shared';

const finishLabels: Record<string, string> = {
  SUCCEEDED: '本轮升级成功',
  FAILED: '本轮升级失败',
  TIMED_OUT: '本轮执行超时',
  CANCELED: '本轮已取消',
};

type EventQuery = {
  timeline?: AttemptEventTimeline;
  loading: boolean;
  error: unknown;
  retry: () => void;
};

function AttemptHistory({ attempt, timeline, loading, error, retry }: EventQuery & { attempt: Attempt }) {
  const recent = timeline?.events ?? [];
  const events = recent.map((event) => ({
    key: event.eventId,
    at: event.occurredAt,
    title: event.message || event.reasonCode || event.type,
  }));
  if (!recent.some((event) => event.type === 'ATTEMPT_CREATED')) {
    events.push({ key: 'created', at: attempt.createTime, title: '创建执行轮次' });
  }
  if (attempt.startedAt != null && !recent.some((event) => event.type === 'RUNNING')) {
    events.push({ key: 'started', at: attempt.startedAt, title: '收到设备执行进度' });
  }
  if (attempt.finishedAt != null && !recent.some((event) => event.type === attempt.state)) {
    events.push({ key: 'finished', at: attempt.finishedAt, title: finishLabels[attempt.state] ?? '本轮已结束' });
  }

  return (
    <div className="space-y-3 border-t px-4 py-3">
      <p className="text-xs leading-5 text-muted-foreground">
        过程事件保留 24 小时。{timeline?.truncated && ' 当前展示最近一批事件。'}
      </p>
      <Failure error={error} retry={retry} />
      {loading && <Loading />}
      {timeline && recent.length === 0 && (
        <p className="text-xs text-muted-foreground">最近 24 小时暂无过程事件。</p>
      )}
      <ol className="ml-1.5 space-y-4 border-l pl-4">
        {events.sort((a, b) => b.at - a.at).map((event) => (
          <li key={event.key} className="relative space-y-0.5">
            <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{event.title}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function AttemptTimeline({ attempts, activeAttemptNo, onToggle, ...query }: EventQuery & {
  attempts: Attempt[];
  activeAttemptNo: number | null;
  onToggle: (attemptNo: number) => void;
}) {
  if (attempts.length === 0) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">暂无执行轮次记录。</p>;
  }

  return (
    <div className="space-y-3">
      {attempts.map((attempt) => (
        <details key={attempt.id} className="rounded-lg border" open={attempt.attemptNo === activeAttemptNo}>
          <summary
            className="cursor-pointer px-4 py-3 text-sm"
            onClick={(event) => {
              event.preventDefault();
              onToggle(attempt.attemptNo);
            }}
          >
            <span className="mx-2 font-medium">第 {attempt.attemptNo} 轮</span>
            <Status value={attempt.state} />
            {attempt.failureCode && <span className="ml-2 break-all text-xs text-muted-foreground">原因：{attempt.failureCode}</span>}
          </summary>
          {attempt.attemptNo === activeAttemptNo && <AttemptHistory attempt={attempt} {...query} />}
        </details>
      ))}
    </div>
  );
}
