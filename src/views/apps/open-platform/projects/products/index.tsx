import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { MoreHorizontal, PackagePlus, SearchIcon } from 'lucide-react';

import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { ProductLifecycleBadge } from '@/components/open-platform/product-lifecycle-badge';
import { Button } from '@/components/ui/button';
import { PRODUCT_LIFECYCLE_LABEL } from '@/lib/open-platform-labels';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

type DemoProduct = {
  productId: string;
  productName: string;
  productModel: string;
  /** Stable identity — keep for API/joins. */
  categoryCode: string;
  /**
   * Display name from backend (CR: Product list VO should return this).
   * Prefer over categoryCode in UI.
   */
  categoryName: string;
  lifecycleStatus: 'DRAFT' | 'PUBLISHED' | 'DISABLED' | 'DEPRECATED';
  updatedAt: number;
};

/** UI-density demo rows until Project-scoped thing-model list is wired. */
const DEMO_PRODUCTS: DemoProduct[] = [
  {
    productId: 'prod_thermostat_01',
    productName: '智能温控器',
    productModel: 'TH-100',
    categoryCode: 'hvac.thermostat',
    categoryName: '温控器',
    lifecycleStatus: 'PUBLISHED',
    updatedAt: Date.UTC(2026, 7, 18, 10, 0, 0),
  },
  {
    productId: 'prod_gateway_01',
    productName: '边缘网关',
    productModel: 'GW-200',
    categoryCode: 'gateway.edge',
    categoryName: '边缘网关',
    lifecycleStatus: 'DRAFT',
    updatedAt: Date.UTC(2026, 7, 19, 14, 30, 0),
  },
  {
    productId: 'prod_sensor_01',
    productName: '温湿度传感器',
    productModel: 'STH-10',
    categoryCode: 'sensor.env',
    categoryName: '环境传感器',
    lifecycleStatus: 'PUBLISHED',
    updatedAt: Date.UTC(2026, 7, 15, 9, 12, 0),
  },
  {
    productId: 'prod_lock_01',
    productName: '智能门锁',
    productModel: 'LK-Pro',
    categoryCode: 'security.lock',
    categoryName: '智能门锁',
    lifecycleStatus: 'DISABLED',
    updatedAt: Date.UTC(2026, 7, 10, 16, 45, 0),
  },
];

const BCrumb = [
  { to: '/projects', title: '项目' },
  { title: '产品' },
];

const STATUS_ALL = 'ALL';

const ProjectProductsPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState(STATUS_ALL);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return DEMO_PRODUCTS.filter((p) => {
      if (status !== STATUS_ALL && p.lifecycleStatus !== status) return false;
      if (!q) return true;
      return (
        p.productName.toLowerCase().includes(q) ||
        p.productId.toLowerCase().includes(q) ||
        p.productModel.toLowerCase().includes(q)
      );
    });
  }, [keyword, status]);

  const counts = useMemo(() => {
    const all = DEMO_PRODUCTS.length;
    const published = DEMO_PRODUCTS.filter((p) => p.lifecycleStatus === 'PUBLISHED').length;
    const draft = DEMO_PRODUCTS.filter((p) => p.lifecycleStatus === 'DRAFT').length;
    return { all, published, draft };
  }, []);

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="产品" items={BCrumb} />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="products">
        <div className="flex h-full min-h-[28rem] flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">产品开发</h3>
              <p className="text-sm text-muted-foreground">
                当前项目 <span className="font-mono text-xs">{projectId}</span>{' '}
                下的产品与物模型入口
              </p>
            </div>
            <Button type="button" className="shrink-0 gap-1" disabled>
              <PackagePlus className="size-4" aria-hidden />
              创建产品
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['全部', counts.all],
                ['已发布', counts.published],
                ['草稿', counts.draft],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-72">
              <SearchIcon
                size={16}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索产品名称 / 型号 / ID"
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v ?? STATUS_ALL)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="生命周期" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>全部状态</SelectItem>
                <SelectItem value="DRAFT">{PRODUCT_LIFECYCLE_LABEL.DRAFT}</SelectItem>
                <SelectItem value="PUBLISHED">
                  {PRODUCT_LIFECYCLE_LABEL.PUBLISHED}
                </SelectItem>
                <SelectItem value="DISABLED">
                  {PRODUCT_LIFECYCLE_LABEL.DISABLED}
                </SelectItem>
                <SelectItem value="DEPRECATED">
                  {PRODUCT_LIFECYCLE_LABEL.DEPRECATED}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品</TableHead>
                  <TableHead>型号</TableHead>
                  <TableHead>品类</TableHead>
                  <TableHead>生命周期</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-end">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      没有符合条件的产品
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium">{p.productName}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {p.productId}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{p.productModel}</TableCell>
                      <TableCell>
                        <span className="text-sm">{p.categoryName || p.categoryCode}</span>
                      </TableCell>
                      <TableCell>
                        <ProductLifecycleBadge status={p.lifecycleStatus} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(p.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button type="button" variant="ghost" size="icon-sm">
                                <MoreHorizontal aria-hidden />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled>查看物模型</DropdownMenuItem>
                            <DropdownMenuItem disabled>编辑连接配置</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            列表为界面密度演示数据；正式产品 CRUD 将按 Project 作用域物模型接口接入。
          </p>
        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectProductsPage;
