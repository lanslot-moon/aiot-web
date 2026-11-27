import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import useSWR, { SWRConfig } from 'swr';
import { Plus, Thermometer, Workflow } from 'lucide-react';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { BreadcrumbTrail } from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { useIam } from '@/context/iam-context/identity';
import { Button } from '@/components/ui/button';
import { RuleEditor } from '@/components/rule-engine/rule-editor';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { formatDateTime } from '@/lib/date-time';
import { RuleStatus } from '@/components/rule-engine/rule-status';
import { preset } from '@/components/rule-engine/graph';
import { pagePath, ruleRequest, type Page, type Rule } from '@/api/rule-engine/client';

const lifecycleOptions = [
  { value: 'ALL', label: '全部生命周期' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'ENABLED', label: '已启用' },
  { value: 'DISABLED', label: '已停用' },
];
const pageSizes = [10, 30, 50].map((size) => ({ value: String(size), label: size + ' 条 / 页' }));

function Workspace({ projectId, ruleId }: { projectId: string; ruleId?: string }) {
  const [params] = useSearchParams();
  const [query, setQuery] = useState({ keyword: '', status: '' });
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [history, setHistory] = useState<string[]>(['']);
  const [pageSize, setPageSize] = useState('30');
  const cursor = history[history.length - 1];
  const isNew = ruleId === 'new';
  const base = '/projects/' + encodeURIComponent(projectId) + '/rule-chains';
  const listPath = pagePath('rules', cursor, {
    pageSize,
    ...(query.keyword && { keyword: query.keyword }),
    ...(query.status && { status: query.status }),
  });
  const list = useSWR(!ruleId ? [projectId, listPath] : null, () =>
    ruleRequest<Page<Rule>>(projectId, listPath),
  );
  const detail = useSWR(
    ruleId && !isNew ? [projectId, 'rule', ruleId] : null,
    () => ruleRequest<Rule>(projectId, 'rules/' + encodeURIComponent(ruleId!)),
    { revalidateOnFocus: false },
  );
  if (isNew)
    return <RuleEditor projectId={projectId} initial={preset(params.get('example') === 'pump')} />;
  if (ruleId) {
    if (detail.error && !detail.data)
      return (
        <p role="alert">
          {detail.error.message}{' '}
          <Button variant="outline" onClick={() => void detail.mutate()}>
            重新加载
          </Button>
        </p>
      );
    return detail.data ? (
      <RuleEditor projectId={projectId} initial={detail.data} existing={detail.data} />
    ) : (
      <p>正在读取规则草稿…</p>
    );
  }
  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--rule-accent)/10 text-(--rule-accent)">
            <Workflow size={16} />
          </span>
          <h2 className="text-sm font-medium">规则引擎</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link to={base + '/new?example=pump'} />}>
            <Thermometer /> 使用冷却泵示例
          </Button>
          <Button render={<Link to={base + '/new'} />}>
            <Plus /> 新建规则链
          </Button>
        </div>
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          setQuery({
            keyword: String(fields.get('keyword')).trim(),
            status: selectedStatus === 'ALL' ? '' : selectedStatus,
          });
          setHistory(['']);
        }}
        onReset={() => {
          setSelectedStatus('ALL');
          setQuery({ keyword: '', status: '' });
          setHistory(['']);
        }}
      >
        <Input
          type="search"
          name="keyword"
          maxLength={128}
          aria-label="规则关键字"
          placeholder="搜索名称、描述或规则 ID"
          className="w-64 max-w-full"
        />
        <Select
          value={selectedStatus}
          items={lifecycleOptions}
          onValueChange={(value) => setSelectedStatus(value ?? 'ALL')}
        >
          <SelectTrigger aria-label="生命周期" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false} className="min-w-0!">
            {lifecycleOptions.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm">
          查询
        </Button>
        <Button type="reset" size="sm" variant="outline">
          重置
        </Button>
      </form>
      <section aria-label="项目规则链" aria-busy={list.isLoading}>
        {list.error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            {list.error.message}
            <Button variant="outline" onClick={() => void list.mutate()}>
              重新加载
            </Button>
          </p>
        ) : (
          <GatewayDataTable<Rule>
            rows={list.data?.items ?? []}
            emptyMessage={
              list.isLoading
                ? '正在读取规则链…'
                : query.keyword || query.status
                  ? '没有符合条件的规则链'
                  : '暂无规则链'
            }
            columns={[
              {
                label: '规则名称',
                render: (row) => (
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    to={base + '/' + encodeURIComponent(row.ruleId)}
                  >
                    {row.name}
                  </Link>
                ),
              },
              {
                label: '规则 ID',
                render: (row) => (
                  <span className="font-mono text-xs text-muted-foreground">{row.ruleId}</span>
                ),
              },
              {
                label: '描述',
                render: (row) => (
                  <span className="block max-w-72 whitespace-normal break-words">
                    {row.description || '—'}
                  </span>
                ),
              },
              { label: '生命周期', render: (row) => <RuleStatus status={row.status} /> },
              { label: '草稿修订', render: (row) => row.draftRevision },
              {
                label: '创建时间',
                render: (row) => (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(row.createdTime)}
                  </span>
                ),
              },
              {
                label: '修改时间',
                render: (row) => (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(row.updatedTime)}
                  </span>
                ),
              },
            ]}
          />
        )}
      </section>
      <nav
        aria-label="规则链分页"
        className="flex flex-wrap items-center justify-end gap-3 text-sm"
      >
        <span className="text-muted-foreground">
          第 {history.length} 页{list.data && ` · 本页 ${list.data.items.length} 条`}
        </span>
        <Select
          value={pageSize}
          items={pageSizes}
          onValueChange={(value) => {
            if (value) {
              setPageSize(value);
              setHistory(['']);
            }
          }}
        >
          <SelectTrigger aria-label="每页条数" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false} className="min-w-0!">
            {pageSizes.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={history.length <= 1}
          onClick={() => setHistory([''])}
        >
          首页
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={history.length <= 1}
          onClick={() => setHistory(history.slice(0, -1))}
        >
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!list.data?.hasMore || !list.data.nextCursor || !!list.error}
          onClick={() => {
            if (list.data?.nextCursor) setHistory([...history, list.data.nextCursor]);
          }}
        >
          下一页
        </Button>
      </nav>
    </section>
  );
}

export default function RuleChainsPage() {
  const { projectId = '', ruleId } = useParams();
  const { session } = useIam();
  useEffect(() => {
    document.title = '规则引擎 · AIoT';
  }, []);
  return (
    <div data-fill-page className="flex flex-1 flex-col gap-px bg-border p-px">
      <ProjectWorkspaceShell
        fillHeight
        navigationMode="sidebar"
        activePrimary="rule-chains"
        breadcrumbs={
          <BreadcrumbTrail title="规则引擎" items={[{ title: '项目', to: '/projects' }]} />
        }
      >
        <SWRConfig
          key={[projectId, session?.sessionId, ruleId ?? 'list'].join(':')}
          value={{ provider: () => new Map() }}
        >
          <div className="rule-workspace min-w-0 bg-background">
            <Workspace key={ruleId ?? 'list'} projectId={projectId} ruleId={ruleId} />
          </div>
        </SWRConfig>
      </ProjectWorkspaceShell>
    </div>
  );
}
