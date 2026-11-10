import BuildAttempts from './build-attempts';
import VerificationInfo from './verification-info';
import { formatDateTime } from '@/lib/date-time';
import { Pager } from '@/components/policy/shared';
import { by, useAction, usePage } from './hooks';
import { useState, useRef } from 'react';
import useSWR from 'swr';
import { ArrowLeft, ChevronDown, ChevronUp, Info, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { IamFileUploader } from '@/components/iam/file-uploader';
import { DeviceTable, DetailField } from '@/components/device/layout';
import { usePermission } from '@/context/iam-context/identity';
import {
  otaRequest,
  type Package,
  type Build,
  type Verification,
  type FirmwareVersion,
} from '@/api/ota/client';
import { Choice, Failure, Field, Help, Loading, Modal, RemoteChoice, Status } from './shared';
import Tasks from './tasks';
import ScopePicker from './scope-picker';
import ReleaseWizard from './release-wizard';
import { useDraftRegistration } from '@/components/iam/drafts';
const activeBuildStates = ['PENDING', 'RUNNING', 'VERIFYING', 'UPLOADING', 'RETRY_WAIT'];

function formatFirmwareSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

interface Upload {
  fileId: string;
  sha256: string;
}
function FirmwareUpload({
  label,
  onChange,
  disabled,
}: {
  label: string;
  onChange: (file: Upload | undefined) => void;
  disabled?: boolean;
}) {
  const hash = useRef('');
  const hashes = useRef(new WeakMap<File, string>());
  return (
    <Field title={label}>
      <IamFileUploader
        compactSelection
        directory="/ota/firmware"
        storageType="private"
        externalBusy={disabled}
        prepareFile={async (file) => {
          const bytes = await file.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          hashes.current.set(
            file,
            Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(''),
          );
          return file;
        }}
        onFileChange={(file) => {
          hash.current = file ? (hashes.current.get(file) ?? '') : '';
          onChange(undefined);
        }}
        onUploaded={(file) => onChange({ fileId: file.fileId, sha256: hash.current })}
      />
    </Field>
  );
}
export function CreatePackage({
  projectId,
  moduleId,
  version,
  onClose,
  onCreated,
}: {
  projectId: string;
  moduleId: string;
  version: FirmwareVersion;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  useDraftRegistration(true);
  const [kind, setKind] = useState('FULL');
  const [source, setSource] = useState<FirmwareVersion>();
  const [algorithm, setAlgorithm] = useState('BSDIFF');
  const [targetFile, setTargetFile] = useState<Upload>();
  const [sourceFile, setSourceFile] = useState<Upload>();
  const [created, setCreated] = useState<Package>();
  const action = useAction();
  async function save() {
    await action.run(
      async () => {
        if (source?.id === version.id && kind === 'DELTA')
          throw new Error('源版本不能与目标版本相同。');
        if (!targetFile || (kind === 'DELTA' && (!source || !sourceFile)))
          throw new Error('请完成所需固件文件的上传，并选择源版本。');
        const pkg =
          created ??
          (await otaRequest<Package>(projectId, 'packages', 'POST', {
            targetVersionId: version.id,
            packageType: kind,
            targetImageSha256: targetFile.sha256,
            ...(kind === 'DELTA'
              ? {
                  sourceVersion: source!.versionText,
                  sourceImageSha256: sourceFile!.sha256,
                  algorithmId: algorithm,
                }
              : {}),
          }));
        setCreated(pkg);
        if (kind === 'FULL') {
          const current = await otaRequest<Package>(projectId, `packages/${pkg.id}`);
          if (!current.files?.some((file) => file.fileId === targetFile.fileId))
            await otaRequest(projectId, `packages/${pkg.id}/files`, 'POST', {
              fileId: targetFile.fileId,
              fileRole: 'FIRMWARE',
              orderNo: 0,
            });
        } else
          await otaRequest(projectId, 'delta-builds', 'POST', {
            packageId: pkg.id,
            sourceFirmwareId: source!.id,
            targetFirmwareId: version.id,
            sourceFileId: sourceFile!.fileId,
            targetFileId: targetFile.fileId,
          });
        onCreated(pkg.id);
      },
      kind === 'DELTA' ? '差分构建已提交' : '升级包文件已登记',
    );
  }
  return (
    <Modal
      title={`准备升级包 · ${version.versionText}`}
      open
      busy={action.busy}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={created ? () => onCreated(created.id) : onClose}
          >
            {created ? '查看已创建的包' : '取消'}
          </Button>
          <Button disabled={action.busy || !targetFile} onClick={() => void save()}>
            {action.busy
              ? '提交中…'
              : created
                ? '继续处理'
                : kind === 'DELTA'
                  ? '创建并构建'
                  : '创建升级包'}
          </Button>
        </>
      }
    >
      <fieldset disabled={action.busy || !!created} className="space-y-5">
        <Field title="升级包类型">
          <Choice
            label="升级包类型"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: 'FULL', label: '全量包' },
              { value: 'DELTA', label: '差分包' },
            ]}
          />
        </Field>
        {kind === 'DELTA' && (
          <>
            <Field title="源固件版本">
              <RemoteChoice<FirmwareVersion>
                projectId={projectId}
                path={by('firmware/versions', { moduleId })}
                value={source?.id ?? ''}
                label="源版本"
                text={(v) => v.versionText}
                onChange={(_, v) => setSource(v)}
              />
            </Field>
            <Field
              title="差分算法"
              help="算法需与设备支持的差分还原能力一致。后台生成差分后会进行还原校验。"
            >
              <Choice
                label="差分算法"
                value={algorithm}
                onValueChange={setAlgorithm}
                options={['BSDIFF', 'HDIFFPATCH', 'VCDIFF'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Field>
            <FirmwareUpload label="源固件文件" onChange={setSourceFile} />
          </>
        )}
        <FirmwareUpload label="目标固件文件" onChange={setTargetFile} />
      </fieldset>
      {created && (
        <p className="text-xs text-muted-foreground">
          已创建升级包 {created.id}，继续处理将复用此记录。
        </p>
      )}
      <Failure error={action.error} />
    </Modal>
  );
}

function ResumePreparation({
  projectId,
  moduleId,
  pkg,
  onDone,
}: {
  projectId: string;
  moduleId: string;
  pkg: Package;
  onDone: () => Promise<void>;
}) {
  const [source, setSource] = useState<FirmwareVersion>();
  const [sourceFile, setSourceFile] = useState<Upload>();
  const [targetFile, setTargetFile] = useState<Upload>();
  const action = useAction();
  async function save() {
    await action.run(async () => {
      if (!targetFile) throw new Error('请先上传目标固件文件。');
      if (pkg.targetImageSha256 && targetFile.sha256 !== pkg.targetImageSha256)
        throw new Error('目标文件摘要与当前升级包不一致。');
      if (pkg.packageType === 'DELTA') {
        if (!source || source.versionText !== pkg.sourceVersionText || !sourceFile)
          throw new Error('请选择与升级包一致的源版本，并上传源文件。');
        if (sourceFile.sha256 !== pkg.sourceImageSha256)
          throw new Error('源文件摘要与当前升级包不一致。');
        await otaRequest(projectId, 'delta-builds', 'POST', {
          packageId: pkg.id,
          sourceFirmwareId: source.id,
          targetFirmwareId: pkg.targetVersionId,
          sourceFileId: sourceFile.fileId,
          targetFileId: targetFile.fileId,
        });
      } else {
        const current = await otaRequest<Package>(projectId, `packages/${pkg.id}`);
        if (!current.files?.some((file) => file.fileId === targetFile.fileId))
          await otaRequest(projectId, `packages/${pkg.id}/files`, 'POST', {
            fileId: targetFile.fileId,
            fileRole: 'FIRMWARE',
            orderNo: 0,
          });
      }
      await onDone();
    }, '制包操作已提交');
  }
  return (
    <div className="space-y-4">
      {pkg.packageType === 'DELTA' && (
        <>
          <Field title={`源固件版本 · ${pkg.sourceVersionText}`}>
            <RemoteChoice<FirmwareVersion>
              projectId={projectId}
              path={by('firmware/versions', { moduleId, version: pkg.sourceVersionText })}
              value={source?.id ?? ''}
              label="源版本"
              text={(v) => v.versionText}
              onChange={(_, item) => setSource(item)}
            />
          </Field>
          <FirmwareUpload label="源固件文件" onChange={setSourceFile} disabled={action.busy} />
        </>
      )}
      <FirmwareUpload label="目标固件文件" onChange={setTargetFile} disabled={action.busy} />
      <Failure error={action.error} />
      <Button disabled={action.busy || !targetFile} onClick={() => void save()}>
        {pkg.packageType === 'DELTA' ? '提交差分构建' : '关联固件文件'}
      </Button>
    </div>
  );
}

export default function PackageDetail({
  projectId,
  productId,
  moduleId,
  id,
  version,
  onBack,
  onPublishVersion,
  onReleaseCreated,
}: {
  projectId: string;
  productId: string;
  moduleId: string;
  id: string;
  version?: FirmwareVersion;
  onBack: () => void;
  onPublishVersion: () => Promise<void>;
  onReleaseCreated: (id: string) => void;
}) {
  const pkg = useSWR([projectId, 'ota-package', id], () =>
    otaRequest<Package>(projectId, `packages/${id}`),
  );
  const build = useSWR(
    pkg.data?.packageType === 'DELTA' ? [projectId, 'ota-build-package', id] : null,
    () => otaRequest<Build | null>(projectId, `delta-builds/by-package/${id}`),
    {
      onSuccess: (result) => {
        if (
          result?.status === 'SUCCEEDED' &&
          ['DRAFT', 'BUILDING'].includes(pkg.data?.state ?? '')
        ) {
          void pkg.mutate();
        }
      },
      refreshInterval: (data) => (data && activeBuildStates.includes(data.status) ? 3000 : 0),
    },
  );
  const data = pkg.data;
  const sealed = data?.state === 'SEALED';
  const revoked = data?.state === 'REVOKED';
  const verifications = usePage<Verification>(
    projectId,
    sealed || revoked ? by('verifications', { packageId: id }) : null,
    sealed ? 5000 : 0,
  );
  const [picker, setPicker] = useState(false);
  const [selectedVerification, setVerification] = useState<string>();
  const [releaseOpen, setReleaseOpen] = useState(false);
  const action = useAction();
  const create = usePermission('ota:create');
  const update = usePermission('ota:update');
  const runningVerification = verifications.rows.find((r) => r.state === 'RUNNING');
  const verification = selectedVerification ?? runningVerification?.id;
  const record = useSWR(
    verification ? [projectId, 'verification', verification] : null,
    () => otaRequest<Verification>(projectId, `verifications/${verification}`),
    {
      refreshInterval: (result) => (result?.state === 'RUNNING' ? 5000 : 0),
      onSuccess: (result) => {
        if (result.state === 'PASSED' || result.state === 'FAILED') void verifications.mutate();
        if (result.state === 'PASSED' && !data?.verificationPassed) void pkg.mutate();
      },
    },
  );
  async function refresh() {
    await Promise.all([pkg.mutate(), build.mutate(), verifications.mutate(), record.mutate()]);
  }
  async function seal() {
    await action.run(async () => {
      await otaRequest(projectId, `packages/${id}/seal`, 'POST');
      await refresh();
    }, '升级包已准备好，可以开始样机验证');
  }
  async function createVerification(ids: string[]) {
    let created = false;
    const started = await action.run(async () => {
      const result = await otaRequest<Verification>(projectId, 'verifications', 'POST', {
        packageId: id,
        deviceIds: ids,
      });
      created = true;
      try {
        await otaRequest(projectId, `verifications/${result.id}/start`, 'POST');
      } finally {
        setVerification(result.id);
        await verifications.mutate();
      }
    }, '样机验证已启动');
    return started || created;
  }
  const isDelta = data?.packageType === 'DELTA';
  const files = data?.files ?? [];
  const readyToSeal = isDelta
    ? data?.state === 'READY_TO_SEAL'
    : data?.state === 'DRAFT' && files.some((file) => file.fileRole === 'FIRMWARE');
  const needsPreparation = !sealed && !revoked && !readyToSeal;
  const buildTask = build.data;
  const building = !!buildTask && activeBuildStates.includes(buildTask.status);
  const canRetryBuild = !!buildTask && ['FAILED', 'CANCELED'].includes(buildTask.status);
  const canResume =
    update &&
    data?.state === 'DRAFT' &&
    (isDelta ? buildTask === null && !build.error : !readyToSeal);
  const targetVersion = version?.id === data?.targetVersionId ? version : undefined;
  const summary = [
    targetVersion && `目标版本 ${targetVersion.versionText}`,
    data?.sourceVersionText && `源版本 ${data.sourceVersionText}`,
    files.length > 0 &&
      `文件大小 ${formatFirmwareSize(files.reduce((sum, file) => sum + file.sizeBytes, 0))}`,
  ].filter(Boolean);
  const verifying = !!runningVerification || record.data?.state === 'RUNNING';
  const waitingForVerification =
    verifications.data && !verifications.rows.length && !verifications.hasPrevious;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label="返回升级包列表"
            title="返回升级包列表"
            onClick={onBack}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">
                {data ? (isDelta ? '差分升级包' : '全量升级包') : '升级包详情'}
              </h2>
              {data && (
                <>
                  <Status
                    value={
                      data.state === 'BUILDING' && canRetryBuild ? buildTask.status : data.state
                    }
                  />
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button variant="ghost" size="sm" className="text-muted-foreground" />
                      }
                    >
                      <Info /> 包与文件信息
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="max-h-[70dvh] w-[32rem] max-w-[calc(100vw-2rem)] gap-4 overflow-y-auto p-4"
                    >
                      <PopoverTitle>升级包与文件信息</PopoverTitle>
                      <dl className="grid gap-3 sm:grid-cols-2">
                        <DetailField label="升级包 ID">{id}</DetailField>
                        <DetailField label="目标版本 ID">{data.targetVersionId}</DetailField>
                        {data.algorithmId && (
                          <DetailField label="差分算法">{data.algorithmId}</DetailField>
                        )}
                        {data.sourceImageSha256 && (
                          <DetailField label="源镜像 SHA-256" fullWidth>
                            <code className="text-xs">{data.sourceImageSha256}</code>
                          </DetailField>
                        )}
                        <DetailField label="目标镜像 SHA-256" fullWidth>
                          <code className="text-xs">{data.targetImageSha256}</code>
                        </DetailField>
                        <DetailField label="清单摘要" fullWidth>
                          <code className="text-xs">{data.manifestSha256 || '—'}</code>
                        </DetailField>
                      </dl>
                      {!!files.length && (
                        <DeviceTable
                          rows={files}
                          columns={[
                            { label: '文件 ID', render: (file) => file.fileId },
                            { label: '用途', render: (file) => file.fileRole },
                            { label: '大小', render: (file) => formatFirmwareSize(file.sizeBytes) },
                          ]}
                        />
                      )}
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
            {summary.length > 0 && (
              <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {summary.join(' · ')}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pkg.isValidating}
          onClick={() => void refresh()}
        >
          <RefreshCw /> 刷新
        </Button>
      </header>
      <Failure error={pkg.error} retry={() => pkg.mutate()} />
      <Failure error={action.error} />
      {!data ? (
        pkg.isLoading ? (
          <Loading />
        ) : null
      ) : (
        <>
          {needsPreparation && !isDelta && (
            <section className="space-y-3 rounded-lg border p-4 sm:p-5">
              <h3 className="font-semibold">上传固件</h3>
              <p className="text-sm text-muted-foreground">上传目标版本的完整固件文件。</p>
              {canResume && (
                <ResumePreparation
                  projectId={projectId}
                  moduleId={moduleId}
                  pkg={data}
                  onDone={refresh}
                />
              )}
            </section>
          )}
          {readyToSeal && (
            <section className="rounded-lg border p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold">升级包准备未完成</h3>
                  <p className="text-sm text-muted-foreground">
                    固件文件已就绪。重新准备后即可开始样机验证。
                  </p>
                </div>
                {update && (
                  <Button disabled={action.busy} onClick={() => void seal()}>
                    {action.busy ? '正在准备…' : '重试准备'}
                  </Button>
                )}
              </div>
            </section>
          )}
          {(sealed || revoked) && (
            <section
              aria-label="样机验证"
              className={verification ? 'flex min-w-0 flex-1 flex-col gap-3' : 'space-y-3'}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{revoked ? '样机验证记录' : '样机验证'}</h3>
                  {sealed && data.verificationPassed && <Status value="PASSED" />}
                  {sealed && verifying && (
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-blue-700! dark:border-blue-400/50 dark:bg-blue-500/20 dark:text-blue-300!"
                    >
                      验证中
                    </Badge>
                  )}
                  {sealed && waitingForVerification && !verifying && !data.verificationPassed && (
                    <Badge variant="outline">待验证</Badge>
                  )}
                  <Help label="样机验证">
                    {revoked
                      ? waitingForVerification
                        ? '暂无历史验证记录。'
                        : '查看此升级包的历史验证结果。'
                      : data.verificationPassed
                        ? targetVersion?.lifecycleState === 'DRAFT'
                          ? '发布固件版本后即可创建升级批次。'
                          : '创建升级批次，设置设备范围和执行时间。'
                        : verifying
                          ? '可在设备任务中查看每台样机的升级进度。'
                          : '选择要试装此升级包的样机，通过后即可创建升级批次。'}
                  </Help>
                </div>
                {sealed && (
                  <div className="flex flex-wrap gap-2">
                    {create && update && (
                      <Button
                        variant={data.verificationPassed ? 'outline' : 'default'}
                        disabled={action.busy || verifying}
                        onClick={() => {
                          action.setError(undefined);
                          setPicker(true);
                        }}
                      >
                        {data.verificationPassed ? '再次验证' : '开始样机验证'}
                      </Button>
                    )}
                    {data.verificationPassed &&
                      targetVersion?.lifecycleState === 'DRAFT' &&
                      update && (
                        <Button
                          disabled={action.busy}
                          onClick={() => void action.run(onPublishVersion, '固件版本已发布')}
                        >
                          发布固件版本
                        </Button>
                      )}
                    {data.verificationPassed &&
                      targetVersion?.lifecycleState === 'PUBLISHED' &&
                      create && <Button onClick={() => setReleaseOpen(true)}>创建升级批次</Button>}
                  </div>
                )}
              </div>
              <Failure error={verifications.error} retry={() => verifications.mutate()} />
              {verifications.isLoading ? (
                <Loading />
              ) : verifications.rows.length > 0 ? (
                <DeviceTable
                  rows={verifications.rows}
                  columns={[
                    { label: '验证批次', render: (r) => r.id },
                    { label: '状态', render: (r) => <Status value={r.state} /> },
                    {
                      label: '创建时间',
                      render: (r) => (r.createTime != null ? formatDateTime(r.createTime) : '—'),
                    },
                    {
                      label: '包一致性',
                      render: (r) => (
                        <VerificationInfo record={r} currentManifest={data.manifestSha256} />
                      ),
                    },
                    {
                      label: '操作',
                      render: (r) =>
                        r.id === verification ? (
                          <Badge variant="secondary">已展开</Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setVerification(r.id)}>
                            <ChevronDown />
                            {sealed && update && r.state === 'DRAFT' ? '继续验证' : '查看设备任务'}
                          </Button>
                        ),
                    },
                  ]}
                />
              ) : null}
              {(verifications.data?.hasMore || verifications.hasPrevious) && (
                <Pager {...verifications.pagerProps} />
              )}
              {verification && (
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <Failure error={record.error} />
                  <Tasks
                    key={verification}
                    projectId={projectId}
                    sourceType="VERIFICATION"
                    sourceId={verification}
                    toolbarActions={
                      <>
                        {sealed && record.data?.state === 'DRAFT' && update && (
                          <Button
                            size="sm"
                            disabled={action.busy}
                            onClick={() =>
                              void action.run(async () => {
                                await otaRequest(
                                  projectId,
                                  `verifications/${verification}/start`,
                                  'POST',
                                );
                                await refresh();
                              }, '验证已启动')
                            }
                          >
                            启动验证
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setVerification('')}>
                          <ChevronUp /> 收起设备任务
                        </Button>
                      </>
                    }
                  />
                </div>
              )}
            </section>
          )}
          {isDelta && (
            <Collapsible
              key={needsPreparation ? 'preparing' : 'prepared'}
              defaultOpen={needsPreparation}
              className="rounded-lg border"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1">
                <CollapsibleTrigger render={<Button variant="ghost" className="group" />}>
                  <ChevronDown className="-rotate-90 transition-transform group-aria-expanded:rotate-0" />
                  {needsPreparation ? '上传固件与差分构建' : '差分构建记录'}
                </CollapsibleTrigger>
                {buildTask && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Status value={buildTask.status} />
                    <BuildAttempts projectId={projectId} taskId={buildTask.id} />
                  </div>
                )}
              </div>
              <CollapsibleContent className="space-y-3 border-t p-4 sm:p-5">
                <Failure error={build.error} retry={() => build.mutate()} />
                {build.isLoading ? (
                  <Loading />
                ) : buildTask ? (
                  <>
                    <p className="text-sm">
                      进度 {buildTask.progress ?? 0}% · 已执行 {buildTask.attemptCount} 轮
                    </p>
                    {building && (
                      <p className="text-sm text-muted-foreground">
                        构建完成后平台会自动准备升级包。
                      </p>
                    )}
                    {buildTask.msg && (
                      <p className="text-xs text-muted-foreground">{buildTask.msg}</p>
                    )}
                    {needsPreparation && update && (canRetryBuild || building) && (
                      <div className="flex gap-2">
                        {canRetryBuild && (
                          <Button
                            size="sm"
                            disabled={action.busy}
                            onClick={() =>
                              void action.run(async () => {
                                await otaRequest(
                                  projectId,
                                  `delta-builds/${buildTask.id}/retry`,
                                  'POST',
                                );
                                await refresh();
                              })
                            }
                          >
                            重新构建
                          </Button>
                        )}
                        {building && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={action.busy}
                            onClick={() =>
                              void action.run(async () => {
                                await otaRequest(
                                  projectId,
                                  `delta-builds/${buildTask.id}/cancel`,
                                  'POST',
                                );
                                await refresh();
                              })
                            }
                          >
                            取消构建
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  !build.error && (
                    <p className="text-sm text-muted-foreground">
                      上传源固件和目标固件后，提交差分构建。
                    </p>
                  )
                )}
                {canResume && (
                  <ResumePreparation
                    projectId={projectId}
                    moduleId={moduleId}
                    pkg={data}
                    onDone={refresh}
                  />
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
      {picker && (
        <ScopePicker
          projectId={projectId}
          productId={productId}
          selected={[]}
          confirmLabel="开始样机验证"
          busy={action.busy}
          error={action.error}
          onChange={createVerification}
          onClose={() => setPicker(false)}
        />
      )}
      {releaseOpen && data && targetVersion && (
        <ReleaseWizard
          projectId={projectId}
          productId={productId}
          prepared={{ moduleId: targetVersion.moduleId, version: targetVersion, pkg: data }}
          onClose={() => setReleaseOpen(false)}
          onCreated={onReleaseCreated}
        />
      )}
    </div>
  );
}
