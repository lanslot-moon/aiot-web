import { CheckCheck, Clock3, MoreHorizontal } from 'lucide-react';
import type { CommandRecord } from '@/api/device/commands';
import { deliveryLabels, executionLabels } from '@/api/device/commands';
import { formatTime } from '@/api/device/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Payload({ text }: { text: string | null }) {
  let content = text ?? '无参数';
  if (text) {
    try { content = JSON.stringify(JSON.parse(text)); } catch { /* Show non-JSON responses verbatim. */ }
  }
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5">{content}</pre>;
}

export function CommandExchange({ record, onDetails }: {
  record: CommandRecord;
  onDetails: (record: CommandRecord) => void;
}) {
  const result = record.deviceResult;
  const failed = ['FAILED', 'REJECTED', 'NOT_EXECUTED'].includes(record.executionStatus);
  const status = result ? '已回复'
    : record.deliveryStatus === 'NOT_SENT' ? '未发送'
      : record.executionStatus === 'PENDING' ? '待回复'
        : executionLabels[record.executionStatus] ?? record.executionStatus;
  const statusDetail = `${deliveryLabels[record.deliveryStatus] ?? record.deliveryStatus} · ${executionLabels[record.executionStatus] ?? record.executionStatus}`;
  const commandLabel = record.commandType === 'PROPERTY' ? '属性控制' : `服务调用 · ${record.code ?? '—'}`;

  return (
    <article className="flex min-w-0 flex-col gap-3" aria-label={`指令 ${record.requestId}`}>
      <div className="max-w-[94%] min-w-0 self-start space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>我 · {commandLabel}</span>
          <time title={formatTime(record.createTime)}>{formatTime(record.createTime).split(' ').pop()}</time>
          <span className="min-w-0 break-all font-mono text-[10px]" title="消息 ID">{record.requestId}</span>
          <Button variant="ghost" size="icon-xs" aria-label={`查看指令 ${record.requestId} 详情`} title="查看记录详情" onClick={() => onDetails(record)}><MoreHorizontal /></Button>
        </div>
        <div className="space-y-1 rounded-lg rounded-tl-none bg-muted/70 px-3 py-2">
          <Payload text={record.commandType === 'PROPERTY' ? record.properties : record.inputParams} />
        </div>
        <div className={cn('flex items-center justify-end gap-1 text-[10px] text-muted-foreground', failed && 'text-destructive')} role="status" title={statusDetail}>
          {result && <CheckCheck className="size-3" aria-hidden />}{status}
        </div>
      </div>

      {result && (
        <div className="max-w-[94%] min-w-0 self-end space-y-1">
          <div className="flex flex-wrap items-center justify-end gap-x-2 text-[11px] text-muted-foreground">
            <span>设备</span>
            <time title={formatTime(result.receivedAt)}>{formatTime(result.receivedAt).split(' ').pop()}</time>
            <span className="min-w-0 break-all font-mono text-[10px]" title="消息 ID">{record.requestId}</span>
          </div>
          <div className={cn('space-y-1 rounded-lg rounded-tr-none bg-chart-2/10 px-3 py-2', failed && 'bg-destructive/10')}>
            <p className="whitespace-pre-wrap break-words text-xs leading-5">{result.code}{result.message ? ` · ${result.message}` : ''}</p>
            {result.outputParams !== null && <Payload text={result.outputParams} />}
          </div>
        </div>
      )}
      {!result && record.executionStatus === 'PENDING' && record.deliveryStatus !== 'NOT_SENT' && (
        <p className="flex items-center gap-1.5 self-end text-[11px] text-muted-foreground" role="status">
          <Clock3 className="size-3 shrink-0" aria-hidden />等待设备回复
        </p>
      )}
    </article>
  );
}
