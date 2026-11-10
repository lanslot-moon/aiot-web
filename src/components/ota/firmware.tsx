import { Pager } from '@/components/policy/shared';
import { by, useAction, usePage } from './hooks';
import { useState, type ReactNode } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router';
import { ChevronDown, Layers, PackageOpen, Plus, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { DeviceTable } from '@/components/device/layout';
import { usePermission } from '@/context/iam-context/identity';
import { cn } from '@/lib/utils';
import {
  otaRequest,
  splitValues,
  states,
  type FirmwareModule,
  type FirmwareVersion,
  type Package,
} from '@/api/ota/client';
import { Choice, Failure, Field, Input, Loading, Modal, RemoteChoice, Status } from './shared';
import PackageDetail, { CreatePackage } from './package-detail';

// 通道值与后端 FirmwareChannel 枚举一致，建议编码采用项目命名约定。
const standardChannels = [
  { value: '0', label: '主模块', suggestedCode: 'main' },
  { value: '1', label: '蓝牙', suggestedCode: 'bluetooth' },
  { value: '3', label: 'Zigbee', suggestedCode: 'zigbee' },
  { value: '9', label: 'MCU', suggestedCode: 'mcu' },
];
const channelOptions = [...standardChannels, { value: 'custom', label: '自定义扩展通道' }];
const extensionChannelMin = 10;
const extensionChannelMax = 2_147_483_647;

function packageStatus(pkg: Package) {
  if (
    pkg.state === 'BUILDING' &&
    (pkg.buildStatus === 'FAILED' || pkg.buildStatus === 'CANCELED')
  ) {
    return pkg.buildStatus;
  }
  return pkg.state;
}

function hardwareScopeLabel(json: FirmwareVersion['hardwareConstraintJson']) {
  if (!json?.trim()) return '未记录';
  try {
    const scope: unknown = JSON.parse(json);
    if (scope && typeof scope === 'object' && 'hardwareVersions' in scope) {
      const { hardwareVersions } = scope;
      if (
        Array.isArray(hardwareVersions) &&
        hardwareVersions.every((v) => typeof v === 'string' && v.trim())
      ) {
        return hardwareVersions.length ? hardwareVersions.join('、') : '不限定硬件版本';
      }
    }
  } catch {
    return '无法识别';
  }
  return '无法识别';
}

function VersionCellText({ text }: { text?: string }) {
  if (!text) return <span className="block px-2 py-2">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        className="block min-h-9 w-full cursor-pointer truncate rounded-sm px-2 text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        {text}
      </TooltipTrigger>
      <TooltipContent
        align="start"
        className="max-w-[min(22rem,calc(100vw-2rem))] whitespace-pre-wrap wrap-anywhere leading-5"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function FirmwareListViewport({ children, bordered }: { children: ReactNode; bordered?: boolean }) {
  return (
    <div className="lg:relative lg:min-h-0 lg:flex-1">
      <div
        className={cn(
          'max-h-80 overflow-auto lg:absolute lg:inset-0 lg:max-h-none',
          '[&_.overflow-x-auto]:overflow-visible! [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card',
          bordered && 'rounded-lg border',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default function Firmware({
  projectId,
  productId,
  productPicker,
}: {
  projectId: string;
  productId: string;
  productPicker: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const moduleId = params.get('module') ?? '';
  const versionId = params.get('version') ?? '';
  const packageId = params.get('package') ?? '';
  const [form, setForm] = useState('');
  const [name, setName] = useState('');
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [channel, setChannel] = useState('0');
  const code =
    manualCode ?? standardChannels.find((option) => option.value === channel)?.suggestedCode ?? '';
  const [customChannel, setCustomChannel] = useState('');
  const [description, setDescription] = useState('');
  const [hardwareScope, setHardwareScope] = useState<string | null>(null);
  const [hardwareText, setHardwareText] = useState('');
  const [version, setVersion] = useState<FirmwareVersion>();
  const [draftToDelete, setDraftToDelete] = useState<FirmwareVersion>();
  const [packageToDelete, setPackageToDelete] = useState<
    { versionId: string; versionText: string; pkg?: Package } | undefined
  >();
  const action = useAction();
  const { mutate } = useSWRConfig();
  const create = usePermission('ota:create');
  const update = usePermission('ota:update');
  const canDelete = usePermission('ota:delete');
  const versions = usePage<FirmwareVersion>(
    projectId,
    moduleId ? by('firmware/versions', { moduleId }) : null,
  );
  const packages = usePage<Package>(
    projectId,
    versionId ? by('packages', { targetVersionId: versionId }) : null,
  );
  const hasVersionPager = versions.hasPrevious || !!versions.data?.hasMore;
  const hasPackagePager = packages.hasPrevious || !!packages.data?.hasMore;
  const hasNoPackages =
    !!packages.data && !packages.error && !hasPackagePager && packages.rows.length === 0;
  const canDeleteDraftPackages =
    canDelete && (hasPackagePager || packages.rows.some((p) => p.state === 'DRAFT'));
  const selectedResource = useSWR(
    versionId && !versions.rows.some((v) => v.id === versionId)
      ? [projectId, 'ota-selected-version', versionId]
      : null,
    () => otaRequest<FirmwareVersion>(projectId, `firmware/versions/${versionId}`),
  );
  const selectedVersion =
    versions.rows.find((v) => v.id === versionId) ??
    selectedResource.data ??
    (version?.id === versionId ? version : undefined);
  function navigate(values: Record<string, string>) {
    setParams({ section: 'firmware', product: productId, ...values });
  }
  function openForm(type: string) {
    setName('');
    setManualCode(null);
    setChannel('0');
    setCustomChannel('');
    setDescription('');
    setHardwareScope(null);
    setHardwareText('');
    action.setError(undefined);
    setForm(type);
  }
  async function save() {
    await action.run(async () => {
      if (!name.trim()) throw new Error('请填写名称或版本号。');
      if (form === 'module') {
        if (!code.trim()) throw new Error('请填写模块编码。');
        const firmwareChannel = Number(channel === 'custom' ? customChannel : channel);
        if (
          channel === 'custom' &&
          (!Number.isInteger(firmwareChannel) ||
            firmwareChannel < extensionChannelMin ||
            firmwareChannel > extensionChannelMax)
        ) {
          throw new Error(
            `请输入 ${extensionChannelMin} 至 ${extensionChannelMax} 之间的整数通道号。`,
          );
        }
        const result = await otaRequest<FirmwareModule>(projectId, 'firmware/modules', 'POST', {
          productId,
          displayName: name.trim(),
          moduleCode: code.trim(),
          firmwareChannel,
        });
        navigate({ module: result.id });
      } else {
        if (!hardwareScope) throw new Error('请选择硬件兼容范围。');
        const hardwareVersions = hardwareScope === 'specified' ? splitValues(hardwareText) : [];
        if (hardwareScope === 'specified' && !hardwareVersions.length) {
          throw new Error('请填写至少一个适用的硬件版本。');
        }
        const result = await otaRequest<FirmwareVersion>(projectId, 'firmware/versions', 'POST', {
          moduleId,
          version: name.trim(),
          hardwareConstraintJson: JSON.stringify({ hardwareVersions }),
          description: description.trim(),
        });
        setVersion(result);
        navigate({ module: moduleId, version: result.id });
        await versions.mutate();
      }
      setForm('');
    }, '已创建');
  }
  async function deleteDraft() {
    if (!draftToDelete) return;
    await action.run(async () => {
      await otaRequest<void>(projectId, `firmware/versions/${draftToDelete.id}`, 'DELETE');
      setDraftToDelete(undefined);
      setVersion(undefined);
      setParams({ section: 'firmware', product: productId, module: moduleId }, { replace: true });
      const page = await versions.mutate();
      if (page?.items.length === 0) versions.pagerProps.previous?.();
    }, '固件草稿已删除');
  }
  async function deletePackages() {
    if (!packageToDelete) return;
    const { pkg, versionId: targetId } = packageToDelete;
    await action.run(async () => {
      let deletedCount = 1;
      if (pkg) {
        await otaRequest<void>(projectId, `packages/${pkg.id}`, 'DELETE');
      } else {
        deletedCount = await otaRequest<number>(
          projectId,
          `packages/by-version/${targetId}`,
          'DELETE',
        );
      }

      setPackageToDelete(undefined);
      packages.resetPage();
      const listPrefix = by('packages', { targetVersionId: targetId }) + '&';
      await mutate(
        (key) =>
          Array.isArray(key) &&
          key[0] === projectId &&
          key[1] === 'ota' &&
          typeof key[2] === 'string' &&
          key[2].startsWith(listPrefix),
        undefined,
      );
      toast.success(
        pkg
          ? '升级包已删除'
          : deletedCount
            ? `已删除 ${deletedCount} 个草稿升级包`
            : '该版本没有草稿升级包',
      );
    });
  }
  async function publishVersion() {
    await otaRequest(projectId, `firmware/versions/${versionId}/publish`, 'POST');
    await Promise.all([versions.mutate(), selectedResource.mutate()]);
  }
  if (packageId)
    return (
      <PackageDetail
        key={packageId}
        projectId={projectId}
        productId={productId}
        moduleId={moduleId}
        id={packageId}
        version={selectedVersion}
        onPublishVersion={publishVersion}
        onReleaseCreated={(release) => setParams({ product: productId, release })}
        onBack={() => {
          navigate({ module: moduleId, version: versionId });
          void packages.mutate();
        }}
      />
    );
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="grid shrink-0 items-start gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        {productPicker}
        <div className="min-w-0 space-y-2">
          <div className="h-5 text-xs font-medium leading-5">固件模块</div>
          <RemoteChoice<FirmwareModule>
            key={moduleId}
            projectId={projectId}
            path={productId ? by('firmware/modules', { productId }) : null}
            value={moduleId}
            label="固件模块"
            text={(m) => {
              const preset = standardChannels.find(
                ({ value }) => Number(value) === m.firmwareChannel,
              );
              return `${m.displayName} · ${preset?.label ?? `通道 ${m.firmwareChannel}`}`;
            }}
            onChange={(id) => navigate({ module: id })}
          />
        </div>
        {create && (
          <Button
            className="md:mt-7"
            variant="outline"
            disabled={!productId}
            onClick={() => openForm('module')}
          >
            <Plus className="size-4" />
            新建模块
          </Button>
        )}
      </div>
      <Failure error={action.error} />
      <Failure error={selectedResource.error} retry={() => selectedResource.mutate()} />
      {moduleId ? (
        <div className="grid gap-4 lg:min-h-72 lg:flex-1 lg:grid-cols-[clamp(24rem,43%,35rem)_minmax(0,1fr)]">
          <section
            aria-label="固件版本"
            className="flex min-h-72 min-w-0 flex-col rounded-lg border"
          >
            <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 rounded-t-lg border-b bg-muted/20 px-4 py-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Layers aria-hidden="true" className="size-4 text-muted-foreground" />
                固件版本
              </h3>
              {create && (
                <Button size="sm" variant="outline" onClick={() => openForm('version')}>
                  <Plus className="size-3.5" />
                  登记版本
                </Button>
              )}
            </header>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <Failure error={versions.error} retry={() => versions.mutate()} />
              {versions.isLoading ? (
                <Loading />
              ) : versions.rows.length ? (
                <FirmwareListViewport bordered>
                  <Table
                    aria-label="选择固件版本"
                    className={cn('table-fixed', canDelete ? 'min-w-[22rem]' : 'min-w-64')}
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col" className="w-[30%] sm:w-[33%]">
                          版本号
                        </TableHead>
                        <TableHead scope="col" className="w-14 sm:w-20">
                          状态
                        </TableHead>
                        <TableHead scope="col" className="w-20 sm:w-28">
                          硬件兼容
                        </TableHead>
                        <TableHead scope="col">描述</TableHead>
                        {canDelete && (
                          <TableHead scope="col" className="w-14 text-right">
                            <span className="sr-only">操作</span>
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.rows.map((v) => {
                        return (
                          <TableRow
                            key={v.id}
                            data-state={v.id === versionId ? 'selected' : undefined}
                            className="cursor-pointer"
                            onClick={() => {
                              setVersion(v);
                              navigate({ module: moduleId, version: v.id });
                            }}
                          >
                            <TableCell>
                              <button
                                type="button"
                                className="block w-full truncate rounded-sm text-left font-medium focus-visible:outline-2 focus-visible:outline-ring"
                                aria-pressed={v.id === versionId}
                                title={v.versionText}
                              >
                                {v.versionText}
                              </button>
                            </TableCell>
                            <TableCell>
                              <Status value={v.lifecycleState} />
                            </TableCell>
                            <TableCell className="p-0! text-muted-foreground">
                              <VersionCellText
                                text={hardwareScopeLabel(v.hardwareConstraintJson)}
                              />
                            </TableCell>
                            <TableCell className="p-0! text-muted-foreground">
                              <VersionCellText text={v.descriptionText?.trim()} />
                            </TableCell>
                            {canDelete && (
                              <TableCell className="py-0! text-right">
                                {v.id === versionId && (
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    className="align-middle text-destructive hover:text-destructive disabled:text-muted-foreground!"
                                    aria-label={`删除固件草稿 ${v.versionText}`}
                                    disabled={
                                      action.busy || v.lifecycleState !== 'DRAFT' || !hasNoPackages
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      action.setError(undefined);
                                      setDraftToDelete(v);
                                    }}
                                  >
                                    <Trash2 aria-hidden="true" className="size-3.5" />
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </FirmwareListViewport>
              ) : !versions.error ? (
                <p className="m-auto p-4 text-center text-sm text-muted-foreground">暂无固件版本</p>
              ) : null}
            </div>
            {(hasVersionPager || hasPackagePager) && (
              <footer
                className={
                  hasVersionPager
                    ? 'flex min-h-12 shrink-0 items-center justify-end border-t px-4'
                    : 'hidden min-h-12 shrink-0 border-t lg:block'
                }
              >
                {hasVersionPager && <Pager {...versions.pagerProps} />}
              </footer>
            )}
          </section>
          <section aria-label="升级包" className="flex min-h-72 min-w-0 flex-col rounded-lg border">
            <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 rounded-t-lg border-b bg-muted/20 px-4 py-2">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <PackageOpen aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0">升级包</span>
                {selectedVersion && (
                  <span
                    className="truncate border-l pl-2 text-xs font-normal text-muted-foreground"
                    title={selectedVersion.versionText}
                  >
                    {selectedVersion.versionText}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedVersion?.lifecycleState === 'DRAFT' && update && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.busy}
                    onClick={() => void action.run(publishVersion, '固件版本已发布')}
                  >
                    发布版本
                  </Button>
                )}
                {selectedVersion && canDeleteDraftPackages && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={action.busy}
                      render={<Button size="sm" variant="outline" />}
                    >
                      更多操作
                      <ChevronDown aria-hidden="true" className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          action.setError(undefined);
                          setPackageToDelete({
                            versionId,
                            versionText: selectedVersion.versionText,
                          });
                        }}
                      >
                        删除全部升级草稿包
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {selectedVersion && create && (
                  <Button size="sm" onClick={() => setForm('package')}>
                    准备升级包
                  </Button>
                )}
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <Failure error={packages.error} retry={() => packages.mutate()} />
              {packages.isLoading ? (
                <Loading />
              ) : packages.rows.length ? (
                <FirmwareListViewport>
                  <DeviceTable
                    rows={packages.rows}
                    columns={[
                      {
                        label: '升级包',
                        render: (p) => (
                          <div className="space-y-1">
                            <span>{p.packageType === 'FULL' ? '全量包' : '差分包'}</span>
                            <div className="font-mono text-xs text-muted-foreground">{p.id}</div>
                          </div>
                        ),
                      },
                      { label: '源版本', render: (p) => p.sourceVersionText ?? '—' },
                      { label: '状态', render: (p) => <Status value={packageStatus(p)} /> },
                      {
                        label: '操作',
                        render: (p) => (
                          <div className="flex flex-wrap items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate({ module: moduleId, version: versionId, package: p.id })
                              }
                            >
                              管理
                            </Button>
                            {canDelete &&
                              ['DRAFT', 'READY_TO_SEAL', 'FAILED', 'CANCELED'].includes(
                                packageStatus(p),
                              ) && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  aria-label={`删除升级包 ${p.id}`}
                                  disabled={action.busy}
                                  onClick={() => {
                                    action.setError(undefined);
                                    setPackageToDelete({
                                      versionId,
                                      versionText: selectedVersion?.versionText ?? versionId,
                                      pkg: p,
                                    });
                                  }}
                                >
                                  删除
                                </Button>
                              )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </FirmwareListViewport>
              ) : !packages.error ? (
                <div className="m-auto flex flex-col items-center gap-2 p-4 text-center">
                  <PackageOpen aria-hidden="true" className="size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {versionId ? '该版本暂无升级包' : '选择一个固件版本查看升级包'}
                  </p>
                </div>
              ) : null}
            </div>
            {(hasVersionPager || hasPackagePager) && (
              <footer
                className={
                  hasPackagePager
                    ? 'flex min-h-12 shrink-0 items-center justify-end border-t px-4'
                    : 'hidden min-h-12 shrink-0 border-t lg:block'
                }
              >
                {hasPackagePager && <Pager {...packages.pagerProps} />}
              </footer>
            )}
          </section>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-20 text-center text-sm text-muted-foreground">
          {productId
            ? '选择或新建固件模块，开始管理版本与升级包'
            : '选择产品，管理固件模块、版本与升级包'}
        </div>
      )}
      <Modal
        title={form === 'module' ? '新建固件模块' : '登记固件版本'}
        open={form === 'module' || form === 'version'}
        busy={action.busy}
        onClose={() => setForm('')}
        footer={
          <>
            <Button variant="outline" disabled={action.busy} onClick={() => setForm('')}>
              取消
            </Button>
            <Button disabled={action.busy} onClick={() => void save()}>
              保存
            </Button>
          </>
        }
      >
        <Field title={form === 'module' ? '模块名称' : '版本号'}>
          <Input
            aria-label={form === 'module' ? '模块名称' : '版本号'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {form === 'module' ? (
          <div className="grid gap-4 sm:grid-cols-2 [&_[data-slot=select-trigger]]:h-9!">
            <Field title="模块编码">
              <Input
                aria-label="模块编码"
                value={code}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="输入模块编码"
              />
            </Field>
            <Field
              title="固件通道"
              help="选择设备的固件类型。同一产品内每个通道只能使用一次，扩展通道号须与设备上报的 otaChannel 一致。"
            >
              <Choice
                label="固件通道"
                value={channel}
                options={channelOptions}
                onValueChange={setChannel}
                disabled={action.busy}
              />
            </Field>
            {channel === 'custom' && (
              <Field title="扩展通道号">
                <Input
                  aria-label="扩展通道号"
                  type="number"
                  min={extensionChannelMin}
                  max={extensionChannelMax}
                  step={1}
                  placeholder="输入 10 或以上的通道号"
                  value={customChannel}
                  onChange={(e) => setCustomChannel(e.target.value)}
                  disabled={action.busy}
                />
              </Field>
            )}
          </div>
        ) : (
          <>
            <Field
              title="硬件兼容范围"
              help="记录此固件适用的硬件版本。需要限制升级设备时，请在升级批次的「更多匹配条件」中设置硬件版本筛选。"
            >
              <Choice
                label="硬件兼容范围"
                value={hardwareScope}
                placeholder="选择硬件兼容范围"
                options={[
                  { value: 'specified', label: '指定硬件版本' },
                  { value: 'unrestricted', label: '不限定硬件版本' },
                ]}
                onValueChange={setHardwareScope}
                disabled={action.busy}
              />
              {hardwareScope === 'specified' && (
                <Input
                  aria-label="适用硬件版本"
                  placeholder="例如 Rev.A，多个版本用逗号分隔"
                  value={hardwareText}
                  onChange={(e) => setHardwareText(e.target.value)}
                  disabled={action.busy}
                />
              )}
            </Field>
            <Field title="版本说明">
              <Textarea
                aria-label="版本说明"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </>
        )}
        <Failure error={action.error} />
      </Modal>
      <AlertDialog
        open={!!(draftToDelete || packageToDelete)}
        onOpenChange={(open) => {
          if (!open && !action.busy) {
            setDraftToDelete(undefined);
            setPackageToDelete(undefined);
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)]!">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {draftToDelete
                ? '删除固件草稿？'
                : packageToDelete?.pkg
                  ? '删除升级包？'
                  : '删除全部升级草稿包？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {draftToDelete
                ? `将删除固件版本 ${draftToDelete.versionText} 的草稿。`
                : packageToDelete?.pkg
                  ? `将删除升级包 ${packageToDelete.pkg.id}（${states[packageStatus(packageToDelete.pkg)]}）。`
                  : `将删除固件版本 ${packageToDelete?.versionText} 下所有分页的草稿升级包。`}
              删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Failure error={action.error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={action.busy}
              onClick={() => void (draftToDelete ? deleteDraft() : deletePackages())}
            >
              {action.busy ? '正在删除…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {form === 'package' && selectedVersion && (
        <CreatePackage
          projectId={projectId}
          moduleId={moduleId}
          version={selectedVersion}
          onClose={() => setForm('')}
          onCreated={(id) => {
            setForm('');
            navigate({ module: moduleId, version: versionId, package: id });
          }}
        />
      )}
    </div>
  );
}
