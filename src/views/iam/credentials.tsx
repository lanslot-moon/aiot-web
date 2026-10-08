import { get, OpenPlatformApiError, post, put, remove, segment } from '@/api/iam/client';
import type {
AuthorizationInitializedVO,
AuthorizationKeyPairVO,
AuthorizationLastUsedVO,
AuthorizationMetadataVO,
} from '@/api/iam/contracts';
import { IamProjectShell } from '@/components/iam/project-shell';
import { Action, DataTable, ErrorNotice, Loading, Panel, Status } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIam, usePermission } from '@/context/iam-context/identity';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { epoch, reasonFields, useResource } from '../../components/iam/shared-utils';
export default function CredentialsPage() {
  const { projectId = '' } = useParams();
  const { session } = useIam();
  return <ProjectCredentials key={`${projectId}:${session?.sessionId ?? ''}`} projectId={projectId} />;
}

function ProjectCredentials({ projectId }: { projectId: string }) {
  const base = `/api/v1/projects/${segment(projectId)}`;
  const permission = 'project-credential:manage';
  const metadata = useResource<AuthorizationMetadataVO>(
    `${base}/api-credentials/current`,
    permission,
  );
  const available = !!metadata.data?.clientId && metadata.data.status !== 'REVOKED';
  const uninitialized =
    metadata.error instanceof OpenPlatformApiError &&
    metadata.error.status === 404 &&
    metadata.error.code === 'NOT_FOUND';
  const usage = useResource<AuthorizationLastUsedVO>(
    available ? `${base}/api-credential-usage` : null,
    permission,
  );
  const network = useResource<AuthorizationMetadataVO>(
    available ? `${base}/api-network-policy` : null,
    'project-credential:network-policy',
  );
  const [material, setMaterial] = useState<AuthorizationKeyPairVO | null>(null);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [materialError, setMaterialError] = useState<unknown>(null);
  const materialRequest = useRef(0);
  const canViewMaterial = usePermission(permission);

  function closeMaterial() {
    // 关闭后忽略仍在途的响应，避免重新显示刚清除的密钥。
    materialRequest.current += 1;
    setMaterialOpen(false);
    setMaterial(null);
    setMaterialError(null);
    setMaterialLoading(false);
  }

  async function showMaterial() {
    const requestId = ++materialRequest.current;
    setMaterialOpen(true);
    setMaterial(null);
    setMaterialError(null);
    setMaterialLoading(true);
    try {
      const result = await get<AuthorizationKeyPairVO>(`${base}/api-credentials/current/material`);
      if (materialRequest.current === requestId) setMaterial(result);
    } catch (error) {
      if (materialRequest.current === requestId) setMaterialError(error);
    } finally {
      if (materialRequest.current === requestId) setMaterialLoading(false);
    }
  }
  const refresh = () => {
    void metadata.mutate();
    void network.mutate();
    void usage.mutate();
  };
  async function accept(result: AuthorizationInitializedVO) {
    setMaterial(result.keyPair);
    setMaterialOpen(true);
    refresh();
  }
  return (
    <IamProjectShell title="API 凭证">
      <Panel
        title="API 凭证"
        description="每个项目维护一份当前服务端调用凭证。"
        actions={
          uninitialized && (
            <Action
              label="开通 API 凭证"
              permission={permission}
              description="为此项目创建服务端调用凭证。请妥善保存密钥。"
              run={async () =>
                accept(await post<AuthorizationInitializedVO>(`${base}/api-credentials`))
              }
            />
          )
        }
      >
        {metadata.isLoading ? (
          <Loading />
        ) : (
          <>
            <ErrorNotice
              error={uninitialized ? null : metadata.error}
              retry={() => metadata.mutate()}
            />
            {uninitialized && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                尚未开通 API 凭证。开通后可查看密钥并设置来源限制。
              </p>
            )}
            {metadata.data?.status === 'REVOKED' && (
              <p className="text-sm text-muted-foreground">
                此项目凭证已吊销，无法再次启用或开通。
              </p>
            )}
            {!uninitialized && (
              <DataTable
                rows={metadata.data ? [metadata.data] : []}
                columns={[
                  { label: 'Client ID', render: (row) => <code>{row.clientId ?? '未开通'}</code> },
                  { label: '状态', render: (row) => <Status value={row.status} /> },
                  { label: '创建时间', render: (row) => epoch(row.createTime) },
                  { label: '轮换时间', render: (row) => epoch(row.lastRotatedAt) },
                  {
                    label: '操作',
                    render: (row) =>
                      row.clientId &&
                      row.status !== 'REVOKED' && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            disabled={!canViewMaterial || materialLoading}
                            title={!canViewMaterial ? '当前账号没有此操作权限' : undefined}
                            onClick={() => void showMaterial()}
                          >
                            查看密钥
                          </Button>
                          <Action
                            label={row.status === 'ACTIVE' ? '停用' : '启用'}
                            permission={permission}
                            fields={reasonFields}
                            description="更改凭证状态会影响使用此凭证的服务端调用。"
                            run={(values) =>
                              put(`${base}/api-credentials/current`, {
                                ...values,
                                enabled: row.status !== 'ACTIVE',
                              })
                            }
                            done={refresh}
                          />
                          <Action
                            label="轮换"
                            permission={permission}
                            danger
                            fields={reasonFields}
                            description="旧密钥将失效。请更新使用此密钥的服务端应用。"
                            run={async (values) =>
                              accept(
                                await post<AuthorizationInitializedVO>(
                                  `${base}/api-credential-rotations`,
                                  { ...values, confirm: true },
                                ),
                              )
                            }
                          />
                          <Action
                            label="吊销"
                            danger
                            permission={permission}
                            fields={reasonFields}
                            description="永久吊销当前凭证，使用此凭证的请求将无法继续访问。"
                            run={async (values) => {
                              await remove(`${base}/api-credentials/current`, {
                                ...values,
                                confirm: true,
                              });
                              setMaterial(null);
                              refresh();
                            }}
                          />
                        </div>
                      ),
                  },
                ]}
              />
            )}
          </>
        )}
        <Dialog open={materialOpen} onOpenChange={(open) => { if (!open) closeMaterial(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>查看密钥</DialogTitle>
              <DialogDescription>密钥仅在本次弹窗展示，关闭后清除。请妥善保管。</DialogDescription>
            </DialogHeader>
            {materialLoading && <Loading />}
            <ErrorNotice error={materialError} retry={() => void showMaterial()} />
            {material && (
              <div className="space-y-3">
                <Label htmlFor="client-id">Client ID</Label>
                <Input id="client-id" value={material.clientId ?? ''} readOnly autoComplete="off" />
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input id="client-secret" value={material.clientSecret ?? ''} readOnly autoComplete="off" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(material.clientSecret ?? '');
                      toast.success('密钥已复制');
                    } catch {
                      toast.error('无法复制，请手动选择密钥。');
                    }
                  }}
                >
                  复制密钥
                </Button>
              </div>
            )}
            <DialogFooter><Button variant="outline" onClick={closeMaterial}>关闭</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </Panel>
      {available && (
        <>
          <Panel title="最近调用">
            <ErrorNotice error={usage.error} retry={() => usage.mutate()} />
            {usage.error ? null : usage.isLoading ? (
              <Loading />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt>最后调用</dt>
                <dd>{epoch(usage.data?.lastUsedAt)}</dd>
                <dt>来源 IP</dt>
                <dd>{usage.data?.sourceIp ?? '—'}</dd>
                <dt>请求次数</dt>
                <dd>{usage.data?.requestCount ?? 0}</dd>
                <dt>User Agent</dt>
                <dd className="break-all">{usage.data?.userAgent ?? '—'}</dd>
              </dl>
            )}
          </Panel>
          <Panel title="网络访问限制" description="启用后，只允许白名单中的 IP 或 CIDR 来源调用。">
            <ErrorNotice error={network.error} retry={() => network.mutate()} />
            {network.isLoading ? <Loading /> : network.data && (
              <>
                <Status value={network.data.networkPolicyEnabled ? 'ACTIVE' : 'DISABLED'} />
                <p className="text-sm font-mono">
                  {network.data.ipAllowlist?.join('，') || '未配置白名单'}
                </p>
                <Action
                  label="编辑网络策略"
                  permission="project-credential:network-policy"
                  description="调整访问来源限制可能阻止现有应用调用。"
                  fields={[
                    {
                      name: 'enabled',
                      label: '网络限制',
                      options: [
                        { value: 'true', label: '启用白名单' },
                        { value: 'false', label: '不限制来源' },
                      ],
                    },
                    {
                      name: 'ipAllowlist',
                      label: 'IP / CIDR 白名单',
                      type: 'textarea',
                      hint: '每行一个 IP 或 CIDR，最多 100 项',
                    },
                  ]}
                  initial={{
                    enabled: String(network.data.networkPolicyEnabled ?? false),
                    ipAllowlist: network.data.ipAllowlist?.join('\n') ?? '',
                  }}
                  run={(values) =>
                    put(`${base}/api-network-policy`, {
                      enabled: values.enabled === 'true',
                      ipAllowlist: values.ipAllowlist
                        .split(/\n|,/)
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                  done={refresh}
                />
              </>
            )}
          </Panel>
        </>
      )}
    </IamProjectShell>
  );
}
