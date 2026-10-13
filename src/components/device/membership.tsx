import { useRef, useState } from 'react';
import { usePermission } from '@/context/iam-context/identity';
import { DataTable, ErrorNotice } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CursorList, LifecycleBadge } from './shared';
import { deviceRequest, groupPath, query, type DeviceSummary, type GroupMember, type MembershipResult } from '@/api/device/client';

export default function MembershipAction({ projectId, groupId, remove = false, done }: { projectId: string; groupId: string; remove?: boolean; done: () => void }) {
  const allowed = usePermission('device:update');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<unknown>();
  const [results, setResults] = useState<MembershipResult[] | null>(null);
  const [unknown, setUnknown] = useState(false);
  const path = `${groupPath(groupId)}/${remove ? 'devices' : 'candidate-devices'}${query({ keyword: remove ? undefined : search })}`;
  function toggle(id: string, checked: boolean) { setSelected(s => checked ? s.includes(id) ? s : [...s, id] : s.filter(v => v !== id)); }
  async function save() {
    if (pending.current || !selected.length) return;
    pending.current = true; setBusy(true); setError(undefined);
    try {
      const result = await deviceRequest<{ results: MembershipResult[] }>(projectId, `${groupPath(groupId)}/membership-changes`, 'POST', { addDeviceIds: remove ? [] : selected, removeDeviceIds: remove ? selected : [] });
      setResults(result.results); setSelected([]); done();
    } catch (e) {
      // A lost response cannot prove that no member changed. Require a fresh read before another batch.
      setError(e); setUnknown(true); done();
    } finally { pending.current = false; setBusy(false); }
  }
  const rows = (items: DeviceSummary[]) => <DataTable rows={items} columns={[
    { label: '选择', render: d => <Checkbox aria-label={`选择设备 ${d.deviceName}`} checked={selected.includes(d.deviceId)} disabled={busy || d.lifecycle === 'DELETING' || !selected.includes(d.deviceId) && selected.length >= 200} onCheckedChange={checked => toggle(d.deviceId, checked)} /> },
    { label: '设备名称', render: d => <div><span>{d.nickname || d.deviceName}</span><span className="block font-mono text-xs text-muted-foreground">{d.deviceId}</span></div> },
    { label: '产品 ID', render: d => d.productId }, { label: '管理状态', render: d => <LifecycleBadge value={d.lifecycle} /> },
  ]} />;
  return <>
    <Button variant="outline" disabled={!allowed} title={!allowed ? '需要编辑设备权限' : undefined} onClick={() => { setSelected([]); setKeyword(''); setSearch(''); setResults(null); setUnknown(false); setError(undefined); setOpen(true); }}>{remove ? '批量移出' : '添加成员'}</Button>
    <Dialog open={open} onOpenChange={v => { if (!pending.current) setOpen(v); }}><DialogContent className="max-h-[90dvh] max-w-3xl! overflow-y-auto" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>{remove ? '移出直接成员' : '添加直接成员'}</DialogTitle><DialogDescription>{remove ? '仅移除当前组的直接关系，不删除设备或其他组的关系。' : '候选列表已排除当前组的直接成员；子组中的设备仍可直接加入。'} 单批最多 200 台，跨页选择会保留。</DialogDescription></DialogHeader>
      <ErrorNotice error={error} />
      {results ? <div className="space-y-3"><p className="text-sm">已变更 {results.filter(r => r.status === 'CHANGED').length} 项，未变化 {results.filter(r => r.status === 'UNCHANGED').length} 项，失败 {results.filter(r => r.status === 'FAILED').length} 项，未知 {results.filter(r => r.status === 'UNKNOWN').length} 项。</p><DataTable rows={results} columns={[{ label: '设备 ID', render: r => r.deviceId }, { label: '结果', render: r => ({ CHANGED: '已变更', UNCHANGED: '未变化', FAILED: '失败', UNKNOWN: '结果未知' })[r.status] }, { label: '说明', render: r => r.status === 'UNKNOWN' ? `先核对成员关系再重试。${r.code ?? ''}` : r.code ?? '—' }]} /><p className="text-sm text-muted-foreground">失败项不回滚其他成功项。关闭后重新读取成员列表，核对未知项。</p></div> : unknown ? <p role="status" className="text-sm">本批结果未能确认，可能已有部分关系变更。关闭并刷新成员列表，核对后再提交；不要将本次失败视为全部未执行。</p> : <>
        {!remove && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(keyword.trim()); }}><Input aria-label="候选设备名称或昵称前缀" placeholder="设备名称或昵称前缀" value={keyword} maxLength={128} disabled={busy} onChange={e => setKeyword(e.target.value)} /><Button type="submit" variant="outline" disabled={busy}>查询</Button></form>}
        {remove ? <CursorList<GroupMember> key={path} projectId={projectId} path={path}>{items => rows(items.map(m => m.device))}</CursorList> : <CursorList<DeviceSummary> key={path} projectId={projectId} path={path} emptyTitle="没有可添加的设备" emptyDescription="调整条件，或检查设备是否已经直接加入本组。">{rows}</CursorList>}
      </>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setOpen(false); done(); }}>{results || unknown ? '关闭并核对成员' : '取消'}</Button>{!results && !unknown && <><span className="self-center text-sm text-muted-foreground">已选 {selected.length} / 200</span><Button disabled={busy || !selected.length} onClick={() => void save()}>{busy ? '提交中…' : remove ? '确认移出' : '确认添加'}</Button></>}</DialogFooter>
    </DialogContent></Dialog>
  </>;
}
