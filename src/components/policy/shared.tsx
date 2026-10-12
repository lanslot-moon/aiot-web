import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/iam/error-notice';
import { statusLabels } from '@/api/policy/client';
import { cn } from '@/lib/utils';
export const selectClass = 'h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
export function Status({ value }: { value: string }) {
  return <Badge variant="outline" className={cn('whitespace-nowrap font-normal', ['ACTIVE', 'CURRENT', 'VALID'].includes(value) && 'border-emerald-600/25 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400')}>{statusLabels[value] ?? value}</Badge>;
}
export function Loading() { return <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在读取…</div>; }
export function Failure({ error, retry }: { error: unknown; retry?: () => unknown }) { return error ? <ErrorNotice error={error} retry={retry} /> : null; }
export function Field({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) { return <label className="grid min-w-0 gap-2 text-sm"><span className="font-medium">{title}</span>{children}{hint && <span className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span>}</label>; }
export function Pager({ previous, next, busy }: { previous?: () => void; next?: () => void; busy?: boolean }) {
  return <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="outline" disabled={!previous || busy} onClick={previous}>上一页</Button><Button size="sm" variant="outline" disabled={!next || busy} onClick={next}>下一页</Button></div>;
}
