import { linkHorizontal } from 'd3-shape';

const visibleLimit = 4;
const rowHeight = 32;
const sourceTag = 'truncate rounded-md border bg-background px-2.5 py-1 font-mono text-xs font-medium';
const branch = linkHorizontal();

export default function UpgradeRoute({ sources, target }: { sources: string[]; target: string }) {
  const visible = sources.length ? sources.slice(0, visibleLimit) : ['不限版本'];
  const hiddenCount = Math.max(0, sources.length - visibleLimit);
  const rows = visible.length + Number(hiddenCount > 0);
  const height = rows * rowHeight;
  const center = height / 2;

  return (
    <figure aria-label="升级路线" className="rounded-lg border bg-muted/20 px-4 py-3">
      <figcaption className="mb-2 text-xs font-medium">升级路线</figcaption>
      <div className="mx-auto grid w-fit max-w-full grid-cols-[minmax(0,auto)_clamp(3rem,8vw,5rem)_minmax(0,auto)] items-center">
        <ul aria-label="源版本" className="min-w-0">
          {visible.map((version) => (
            <li key={version} className="flex items-center justify-end" style={{ height: rowHeight }}>
              <span title={version} className={sourceTag}>
                {sources.length ? version : <span className="font-sans text-muted-foreground">{version}</span>}
              </span>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="flex items-center justify-end" style={{ height: rowHeight }}>
              <span className={sourceTag} title={`另有 ${hiddenCount} 个源版本`} aria-hidden="true">......</span>
              <span className="sr-only">另有 {hiddenCount} 个源版本</span>
            </li>
          )}
        </ul>
        <svg aria-hidden="true" viewBox={`0 0 80 ${height}`} preserveAspectRatio="none"
          className="w-full text-blue-400 dark:text-blue-400/80" style={{ height }} fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {Array.from({ length: rows }, (_, index) => (
            <path key={index} d={branch({ source: [0, (index + 0.5) * rowHeight], target: [62, center] })!}
              vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`M62 ${center} H77 m-4 -3 4 3 -4 3`} vectorEffect="non-scaling-stroke" />
        </svg>
        <span title={target} className="min-w-0 truncate rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-xs font-semibold text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-300">
          <span className="sr-only">目标版本 </span>{target}
        </span>
      </div>
    </figure>
  );
}
