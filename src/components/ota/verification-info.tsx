import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DetailField } from '@/components/device/layout';
import { formatDateTime } from '@/lib/date-time';
import type { Verification } from '@/api/ota/client';

export default function VerificationInfo({
  record,
  currentManifest,
}: {
  record: Verification;
  currentManifest?: string;
}) {
  const matches =
    record.packageManifestSha256 && currentManifest
      ? record.packageManifestSha256 === currentManifest
      : undefined;
  const statusBadge = (
    <Badge
      variant={matches === false ? 'destructive' : 'outline'}
      className={
        matches
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700! dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-300!'
          : undefined
      }
    >
      {matches === true ? '清单一致' : matches === false ? '清单不一致' : '未比对'}
    </Badge>
  );
  return (
    <div className="flex items-center gap-2">
      {statusBadge}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`查看验证 ${record.id} 的清单信息`}
              title="查看清单信息"
            />
          }
        >
          <Info />
        </PopoverTrigger>
        <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">验证信息</span>
            {statusBadge}
          </div>
          <dl className="space-y-3">
            <DetailField label="创建时间">
              {record.createTime != null ? formatDateTime(record.createTime) : '—'}
            </DetailField>
            <DetailField label="升级包 ID">{record.packageId}</DetailField>
            <DetailField label="验证绑定的 SHA-256">
              <code className="break-all select-all text-xs">
                {record.packageManifestSha256 || '—'}
              </code>
            </DetailField>
            {matches === false && (
              <DetailField label="当前升级包 SHA-256">
                <code className="break-all select-all text-xs">{currentManifest}</code>
              </DetailField>
            )}
          </dl>
          {matches === false && (
            <p className="text-destructive">此记录不能代表当前升级包清单已验证通过。</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
