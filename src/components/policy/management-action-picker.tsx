import { useState } from 'react';
import useSWR from 'swr';
import { searchAtopPermissions, type ManagementScope } from '@/api/policy/client';
import { usePlatformPolicyPermissions } from '@/hooks/use-platform-policy-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CatalogFailure, Loading, Pager } from './shared';

const pageSize = 20;

export default function ManagementActionPicker({ projectId, scope, close, onSelect }: {
  projectId: string; scope: ManagementScope; close: () => void; onSelect: (code: string) => void;
}) {
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [cursors, setCursors] = useState([0]);
  const afterId = cursors[cursors.length - 1];
  const platform = usePlatformPolicyPermissions(projectId, scope === 'platform');
  const atop = useSWR(scope === 'atop' ? [projectId, 'atop-permission-catalog', keyword, afterId] : null,
    () => searchAtopPermissions(projectId, { afterId, limit: pageSize + 1, keyword }), { shouldRetryOnError: false });
  const resource = scope === 'platform' ? platform : atop;
  const options = scope === 'platform'
    ? (platform.data ?? []).filter(item => `${item.permissionName ?? ''} ${item.permissionCode} ${item.resourceTypeCode}`.toLowerCase().includes(input.trim().toLowerCase()))
      .map(item => ({ code: item.permissionCode, name: item.permissionName || item.permissionCode, detail: item.resourceTypeCode }))
    : (atop.data ?? []).slice(0, pageSize).map(item => ({ code: item.permissionCode, name: item.name, detail: item.description }));
  const nextId = (atop.data?.length ?? 0) > pageSize ? atop.data?.[pageSize - 1]?.id : undefined;

  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl!">
      <DialogHeader>
        <DialogTitle>{scope === 'atop' ? '选择设备 ATOP 接口' : '选择平台权限'}</DialogTitle>
        <DialogDescription>{scope === 'atop' ? '接口规则按接口名和版本应用到设备。' : '为用户或项目角色选择平台操作，随后可以限定资源范围。'}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
          <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (scope === 'atop') { setKeyword(input.trim()); setCursors([0]); } }}>
            <Input aria-label="搜索权限目录" placeholder={scope === 'platform' ? '搜索权限名称、权限码或资源类型' : '搜索接口名称'} value={input} maxLength={128} onChange={event => setInput(event.target.value)} />
            {scope === 'atop' && <Button type="submit" variant="outline">搜索</Button>}
          </form>
          {resource.error ? <CatalogFailure projectId={projectId} source={scope} error={resource.error} retry={() => resource.mutate()} /> : resource.isLoading ? <Loading /> : options.length === 0 ?
            <p role="status" className="py-6 text-center text-sm text-muted-foreground">没有符合条件的权限</p> :
            <ul className="max-h-72 divide-y overflow-auto rounded-md border">
              {options.map(option => <li key={option.code}>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-auto! w-full flex-col items-stretch gap-1! rounded-none! text-left whitespace-normal',
                    scope === 'platform'
                      ? 'px-3! py-2! sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.65fr)] sm:items-center sm:gap-3!'
                      : 'p-3!',
                  )}
                  onClick={() => onSelect(option.code)}
                >
                  <span className="wrap-anywhere leading-5">{option.name}</span>
                  <span className="wrap-anywhere font-mono text-xs leading-4 text-muted-foreground">{option.code}</span>
                  {option.detail && <span className="wrap-anywhere text-xs leading-5 font-normal text-muted-foreground">{option.detail}</span>}
                </Button>
              </li>)}
            </ul>}
          {scope === 'atop' && <Pager previous={cursors.length > 1 ? () => setCursors(items => items.slice(0, -1)) : undefined}
            next={nextId === undefined ? undefined : () => setCursors(items => [...items, nextId])} busy={atop.isValidating} />}
      </div>
    </DialogContent>
  </Dialog>;
}
