import { useParams, useSearchParams } from 'react-router';
import { SWRConfig } from 'swr';
import { useIam, usePermission } from '@/context/iam-context/identity';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { BreadcrumbTrail } from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductPicker from '@/components/policy/product-picker';
import Firmware from '@/components/ota/firmware';
import Releases from '@/components/ota/releases';

function Workspace({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const section = params.get('section') === 'firmware' ? 'firmware' : 'releases';
  const productId = params.get('product') ?? '';
  return (
    <div className="flex flex-1 flex-col gap-5">
      <Tabs
        value={section}
        onValueChange={(value) =>
          setParams({
            ...(productId ? { product: productId } : {}),
            ...(value === 'firmware' ? { section: 'firmware' } : {}),
          })
        }
        className="shrink-0 flex-col! gap-0"
      >
        <TabsList
          variant="line"
          aria-label="OTA 功能"
          className="h-10! w-full justify-start gap-5 border-b bg-transparent p-0!"
        >
          <TabsTrigger value="releases" className="h-10 flex-none px-1!">
            升级批次
          </TabsTrigger>
          <TabsTrigger value="firmware" className="h-10 flex-none px-1!">
            固件管理
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {section === 'firmware' ? (
        <Firmware
          key={productId}
          projectId={projectId}
          productId={productId}
          productPicker={
            <ProductPicker
              projectId={projectId}
              value={productId}
              publishedOnly={false}
              compact
              onChange={(product) =>
                setParams({ section: 'firmware', ...(product ? { product } : {}) })
              }
            />
          }
        />
      ) : (
        <Releases projectId={projectId} />
      )}
    </div>
  );
}
export default function OtaWorkspace() {
  const { projectId = '' } = useParams();
  const { session } = useIam();
  const allowed = usePermission('ota:view');
  return (
    <div data-fill-page className="flex flex-1 flex-col gap-px bg-border p-px">
      <ProjectWorkspaceShell
        fillHeight
        navigationMode="sidebar"
        activePrimary="ota"
        breadcrumbs={
          <BreadcrumbTrail title="OTA 升级" items={[{ title: '项目', to: '/projects' }]} />
        }
      >
        <SWRConfig
          key={projectId + (session?.sessionId ?? 'anonymous')}
          value={{ provider: () => new Map(), shouldRetryOnError: false }}
        >
          {allowed ? (
            <Workspace key={projectId} projectId={projectId} />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              当前角色没有查看 OTA 的权限。
            </p>
          )}
        </SWRConfig>
      </ProjectWorkspaceShell>
    </div>
  );
}
