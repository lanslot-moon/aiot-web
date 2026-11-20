import { ArrowRight } from 'lucide-react';

const versionLabel = 'min-w-0 rounded-md border px-2 py-1 font-mono font-medium';

export default function UpgradePath({ source, target }: { source?: string; target?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 align-middle text-xs">
      {source && (
        <>
          <span className={`${versionLabel} border-border bg-muted text-muted-foreground`}>
            <span className="sr-only">源版本 </span>
            <span className="whitespace-normal [overflow-wrap:anywhere]">{source}</span>
          </span>
          <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        </>
      )}
      <span className={`${versionLabel} border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-300`}>
        <span className="sr-only">目标版本 </span>
        <span className="whitespace-normal [overflow-wrap:anywhere]">{target ?? '…'}</span>
      </span>
    </span>
  );
}
