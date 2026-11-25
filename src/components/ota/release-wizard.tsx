import { by, useAction, usePage } from './hooks';
import { ChevronDown, X } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { Pager } from '@/components/policy/shared';
import { Combobox, ComboboxContent, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import ScopePicker from './scope-picker';
import ScopeSearch from './scope-search';
import UpgradeRoute from './upgrade-route';
import { useDraftRegistration } from '@/components/iam/drafts';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DateTimePicker } from '@/components/shared/date-time-picker';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ProductPicker from '@/components/policy/product-picker';
import {
  otaRequest,
  splitValues,
  type FirmwareModule,
  type FirmwareVersion,
  type Package,
  type Release,
  type ReleasePolicy,
} from '@/api/ota/client';
import { cn } from '@/lib/utils';
import { Choice, Failure, Field, Input, Modal, RemoteChoice } from './shared';

type ReleaseDraft = Omit<ReleasePolicy, 'rolloutPercent'> & { rolloutPercent: string };

const initial = (productId: string): ReleaseDraft => ({
  productId,
  moduleId: '',
  targetVersionId: '',
  packageId: '',
  mode: 'STATIC',
  rolloutPercent: '5',
  pushPerMinute: 20,
  rateMode: 'CONSTANT',
  rateStep: 10,
  rateThreshold: 100,
  maxPushPerMinute: 100,
  sourceVersions: [],
  hardwareVersions: [],
  deviceIds: [],
  tags: {},
  priority: 50,
  requireAppConfirm: false,
  upgradeType: 1,
  execTime: 0,
});
function SourceVersionPicker({ projectId, moduleId, selected, locked, onChange }: {
  projectId: string;
  moduleId: string;
  selected: string[];
  locked: boolean;
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const page = usePage<FirmwareVersion>(projectId, open && !locked ? by('firmware/versions', { moduleId }) : null);
  const summary = selected.join('、') || '不限制';
  if (locked) {
    return (
      <Button type="button" variant="outline" disabled className="h-8! w-full justify-between"
        aria-label={`源版本条件：${summary}`}>
        <span className="truncate text-xs" title={summary}>{summary}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Button>
    );
  }
  return (
    <Combobox multiple open={open} onOpenChange={setOpen} value={selected} onValueChange={onChange}
      items={page.rows.map((version) => version.versionText)}>
      <div className="relative">
        <ComboboxTrigger aria-label={`源版本条件：${summary}`}
          render={<Button type="button" variant="outline" className="absolute inset-0 h-full! w-full justify-end px-3" />} />
        <div className="pointer-events-none relative flex min-h-8 flex-wrap items-center gap-1 py-0.5 pr-9 pl-2">
          {selected.length === 0 && <span className="px-1 text-xs text-muted-foreground">不限制</span>}
          {selected.map((version) => (
            <span key={version} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 text-xs">
              <span className="truncate" title={version}>{version}</span>
              <button type="button" aria-label={`移除源版本 ${version}`}
                className="pointer-events-auto inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => onChange(selected.filter((value) => value !== version))}>
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
      <ComboboxContent align="start" sideOffset={4} aria-label="选择源版本" className="min-w-0 rounded-md!">
        <Failure error={page.error} retry={() => page.mutate()} />
        {page.isLoading && <p className="p-2 text-muted-foreground">正在读取版本…</p>}
        {page.data && !page.rows.length && <p className="p-2 text-muted-foreground">暂无固件版本</p>}
        <ComboboxList className="max-h-56 p-0">
          {(version: string) => <ComboboxItem key={version} value={version} className="cn-select-item"><span className="truncate">{version}</span></ComboboxItem>}
        </ComboboxList>
        {(page.hasPrevious || page.data?.hasMore) && <Pager {...page.pagerProps} />}
        {selected.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>清空选择</Button>}
      </ComboboxContent>
    </Combobox>
  );
}

export default function ReleaseWizard({
  projectId,
  productId,
  prepared,
  onClose,
  onCreated,
}: {
  projectId: string;
  productId: string;
  prepared?: { moduleId: string; version: FirmwareVersion; pkg: Package };
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  useDraftRegistration(true);
  const confirmationId = useId();
  const [picker, setPicker] = useState(false);
  const [step, setStep] = useState(prepared ? 1 : 0);
  const [policy, setPolicy] = useState(() => ({
    ...initial(productId),
    ...(prepared && {
      moduleId: prepared.moduleId,
      targetVersionId: prepared.version.id,
      packageId: prepared.pkg.id,
    }),
  }));
  const [pkg, setPkg] = useState(prepared?.pkg);
  const [moduleName, setModuleName] = useState('');
  const [versionName, setVersionName] = useState(prepared?.version.versionText ?? '');
  const [scope, setScope] = useState('all');
  const [deviceIdMode, setDeviceIdMode] = useState<'tags' | 'text'>('tags');
  const [deviceIdText, setDeviceIdText] = useState('');
  const deviceIds = deviceIdMode === 'text' ? splitValues(deviceIdText) : policy.deviceIds;
  const sourceVersions = pkg?.packageType === 'DELTA' ? [pkg.sourceVersionText!] : policy.sourceVersions;
  const [hardwareText, setHardwareText] = useState('');
  const [tagText, setTagText] = useState('');
  const [start, setStart] = useState('');
  const [openedAt] = useState(() => new Date());
  const [customEnd, setEnd] = useState<string>();
  const end = customEnd ?? format(addDays(start ? parseISO(start) : openedAt, 2), "yyyy-MM-dd'T'HH:mm");
  const [execute, setExecute] = useState('');
  const action = useAction();
  function patch(values: Partial<ReleaseDraft>) {
    if (values.mode === 'DYNAMIC') setStart('');
    setPolicy((p) => ({ ...p, ...values }));
  }
  function addDevice(id: string) {
    if (deviceIds.includes(id)) return;
    if (deviceIdMode === 'text') {
      setDeviceIdText((text) => [text.trimEnd(), id].filter(Boolean).join('\n'));
    } else {
      patch({ deviceIds: [...deviceIds, id] });
    }
  }
  function toggleDeviceIdMode() {
    if (deviceIdMode === 'tags') {
      setDeviceIdText(policy.deviceIds.join('\n'));
      setDeviceIdMode('text');
    } else {
      patch({ deviceIds });
      setDeviceIdMode('tags');
    }
  }
  function payload(): ReleasePolicy {
    const tags: Record<string, string> = {};
    for (const line of tagText
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean)) {
      const at = line.indexOf('=');
      if (at <= 0 || at === line.length - 1) throw new Error('标签按“名称=值”填写，每行一个。');
      const key = line.slice(0, at).trim();
      if (Object.prototype.hasOwnProperty.call(tags, key)) throw new Error('标签名称不能重复。');
      tags[key] = line.slice(at + 1).trim();
    }
    const result = {
      ...policy,
      description: policy.description?.trim() || undefined,
      rolloutPercent: Number(policy.rolloutPercent),
      sourceVersions,
      hardwareVersions: splitValues(hardwareText),
      deviceIds: scope === 'devices' ? deviceIds : [],
      groupId: scope === 'group' ? policy.groupId : undefined,
      tags,
      effectiveFrom: start ? new Date(start).getTime() : undefined,
      effectiveUntil: end ? new Date(end).getTime() : undefined,
      execTime: execute ? new Date(execute).getTime() : 0,
    };
    if (policy.rateMode === 'CONSTANT') {
      delete result.rateStep;
      delete result.rateThreshold;
      delete result.maxPushPerMinute;
    }
    return result;
  }
  function validate() {
    if (
      step === 0 &&
      (!policy.productId || !policy.moduleId || !policy.targetVersionId || !policy.packageId)
    )
      throw new Error('请选择产品、已发布版本及验证成功的升级包。');
    if (step >= 1) {
      if (scope === 'devices' && !deviceIds.length)
        throw new Error('请填写至少一个设备 ID。');
      if (scope === 'group' && !policy.groupId?.trim()) throw new Error('请填写设备组 ID。');
      if (
        !/^\d+$/.test(policy.rolloutPercent) || Number(policy.rolloutPercent) > 100
      )
        throw new Error('灰度比例须为 0–100 的整数。');
      payload();
    }
    if (step >= 2) {
      if (
        !Number.isInteger(policy.pushPerMinute) ||
        policy.pushPerMinute <= 0 ||
        !Number.isInteger(policy.priority) ||
        policy.priority < 0 ||
        policy.priority > 100
      )
        throw new Error('速率须为正整数，优先级须为 0–100 的整数。');
      if (
        policy.rateMode === 'PROGRESSIVE' &&
        (![policy.rateStep, policy.rateThreshold, policy.maxPushPerMinute].every(
          (v) => Number.isInteger(v) && v! > 0,
        ) ||
          policy.maxPushPerMinute! < policy.pushPerMinute)
      )
        throw new Error('递增参数须为正整数，上限不得低于初始速率。');
      const now = Date.now(),
        from = start ? new Date(start).getTime() : now,
        until = end ? new Date(end).getTime() : undefined;
      if (start && (!Number.isFinite(from) || from - now < 300000 || from - now > 7 * 86400000))
        throw new Error('开始时间须在当前时间后 5 分钟至 7 天内。');
      if (
        until !== undefined &&
        (!Number.isFinite(until) ||
          (start ? until - from < 3600000 || until - from > 30 * 86400000 : until <= now))
      )
        throw new Error(
          start ? '截止时间须在开始时间后 1 小时至 30 天内。' : '截止时间须晚于当前时间。',
        );
      if (execute && new Date(execute).getTime() < from)
        throw new Error('设备执行时间不能早于批次开始时间。');
    }
  }
  function next() {
    try {
      validate();
      action.setError(undefined);
      setStep((s) => s + 1);
    } catch (e) {
      action.setError(e);
    }
  }
  async function save() {
    await action.run(async () => {
      validate();
      const result = await otaRequest<Release>(projectId, 'releases', 'POST', payload());
      onCreated(result.id);
    }, '批次草稿已创建，核对后即可激活');
  }
  return (
    <Modal
      title="新建升级批次"
      open
      wide
      busy={action.busy}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={
              step
                ? () => {
                    setStep((s) => s - 1);
                    action.setError(undefined);
                  }
                : onClose
            }
          >
            {step ? '上一步' : '取消'}
          </Button>
          <Button disabled={action.busy} onClick={step === 3 ? () => void save() : next}>
            {action.busy ? '提交中…' : step === 3 ? '提交批次草稿' : '下一步'}
          </Button>
        </>
      }
    >
      <ol
        aria-label="创建步骤"
        className="grid grid-cols-2 gap-x-4 gap-y-3 border-b pb-5 sm:grid-cols-4"
      >
        {['选择固件', '升级范围', '升级策略', '检查提交'].map((label, i) => (
          <li
            key={label}
            aria-current={step === i ? 'step' : undefined}
            className={cn(
              'flex min-w-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground sm:text-sm',
              step === i && 'font-semibold text-primary',
            )}
          >
            <span
              className={cn(
                'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs',
                step === i && 'bg-primary text-primary-foreground',
              )}
            >
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {step === 0 && (
        <div className="space-y-4">
          <Field title="批次描述（选填）">
            <Input aria-label="批次描述" maxLength={200} value={policy.description ?? ''}
              placeholder="例如：研发验证首批 3 台设备"
              onChange={(event) => patch({ description: event.target.value })} />
          </Field>
          <ProductPicker
            showSearchHint={false}
            projectId={projectId}
            value={policy.productId}
            onChange={(id) => {
              patch({ productId: id, moduleId: '', targetVersionId: '', packageId: '', sourceVersions: [] });
              setPkg(undefined);
            }}
          />
          <Field title="固件模块">
            <RemoteChoice<FirmwareModule>
              projectId={projectId}
              path={
                policy.productId
                  ? by('firmware/modules', { productId: policy.productId, state: 'ACTIVE' })
                  : null
              }
              value={policy.moduleId}
              label="固件模块"
              text={(m) => m.displayName}
              onChange={(id, m) => {
                patch({ moduleId: id, targetVersionId: '', packageId: '', sourceVersions: [] });
                setModuleName(m?.displayName ?? id);
                setPkg(undefined);
              }}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field title="目标版本">
              <RemoteChoice<FirmwareVersion>
                projectId={projectId}
                path={
                  policy.moduleId
                    ? by('firmware/versions', {
                        moduleId: policy.moduleId,
                        lifecycleState: 'PUBLISHED',
                      })
                    : null
                }
                value={policy.targetVersionId}
                label="目标版本"
                text={(v) => v.versionText}
                onChange={(id, v) => {
                  patch({ targetVersionId: id, packageId: '' });
                  setVersionName(v?.versionText ?? id);
                  setPkg(undefined);
                }}
              />
            </Field>
            <Field title="升级包">
              <RemoteChoice<Package>
                projectId={projectId}
                path={
                  policy.targetVersionId
                    ? by('packages', { targetVersionId: policy.targetVersionId, state: 'VERIFIED' })
                    : null
                }
                value={policy.packageId}
                label="升级包"
                text={(p) => p.packageName}
                onChange={(id, p) => {
                  patch({ packageId: id });
                  setPkg(p);
                }}
              />
            </Field>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              title="设备范围"
              help="范围、源版本、硬件和标签条件取交集。设备组只包含直接成员。"
            >
              <Choice
                label="设备范围"
                value={scope}
                onValueChange={setScope}
                options={[
                  { value: 'all', label: '当前产品符合条件的设备' },
                  { value: 'devices', label: '指定设备' },
                  { value: 'group', label: '指定设备组' },
                ]}
              />
            </Field>
            <Field title="匹配方式">
              <Choice
                label="匹配方式"
                value={policy.mode}
                onValueChange={(v) => patch({ mode: v as ReleasePolicy['mode'] })}
                options={[
                  { value: 'STATIC', label: '仅匹配本次设备' },
                  { value: 'DYNAMIC', label: '持续匹配新增设备' },
                ]}
              />
            </Field>
          </div>
          {scope === 'devices' && (
            <div className="min-w-0 space-y-2">
              <div className="flex min-h-6 items-center justify-between gap-2">
                <span className="text-xs font-medium">设备 ID</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6! px-2 text-xs"
                  onClick={toggleDeviceIdMode}
                >
                  {deviceIdMode === 'tags' ? '切换为文本' : '切换为标签'}
                </Button>
              </div>
              <div className="flex items-start gap-2">
                <ScopeSearch
                  projectId={projectId}
                  productId={policy.productId}
                  selected={deviceIds}
                  onSelect={addDevice}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                  浏览设备
                </Button>
              </div>
              {deviceIdMode === 'text' ? (
                <Textarea
                  aria-label="设备 ID"
                  placeholder="每行一个设备 ID，或用逗号分隔"
                  value={deviceIdText}
                  onChange={(event) => setDeviceIdText(event.target.value)}
                  className="max-h-28 overflow-y-auto"
                />
              ) : (
                <div className="min-h-8 rounded-lg border border-input px-2 py-1">
                  {deviceIds.length > 0 ? (
                    <ul
                      aria-label="已添加的设备 ID"
                      className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto p-0.5"
                    >
                      {deviceIds.map((id) => (
                        <li key={id} className="min-w-0 max-w-full">
                          <Badge variant="secondary" className="h-auto max-w-full rounded-md! py-0.5 pr-0.5">
                            <span className="min-w-0 truncate font-mono" title={id}>{id}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-5! shrink-0"
                              aria-label={`移除设备 ${id}`}
                              onClick={() => patch({ deviceIds: deviceIds.filter((value) => value !== id) })}
                            >
                              <X aria-hidden />
                            </Button>
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-0.5 text-xs text-muted-foreground">尚未添加设备</p>
                  )}
                </div>
              )}
            </div>
          )}
          {scope === 'group' && (
            <Field title="设备组 ID">
              <div className="flex items-start gap-2">
                <ScopeSearch
                  projectId={projectId}
                  productId={policy.productId}
                  group
                  selected={policy.groupId?.trim() ? [policy.groupId.trim()] : []}
                  onSelect={(id) => patch({ groupId: id })}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                  浏览设备组
                </Button>
              </div>
              <Input
                aria-label="设备组 ID"
                placeholder="也可直接输入完整设备组 ID"
                value={policy.groupId ?? ''}
                onChange={(e) => patch({ groupId: e.target.value })}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              title="源版本条件"
              help="可选择多个源版本，留空表示不限制。差分包固定匹配其源版本。"
            >
              <SourceVersionPicker projectId={projectId} moduleId={policy.moduleId}
                selected={sourceVersions} locked={pkg?.packageType === 'DELTA'}
                onChange={(values) => patch({ sourceVersions: values })} />
            </Field>
            <Field title="灰度比例（%）">
              <Input
                aria-label="灰度比例"
                type="number"
                min={0}
                max={100}
                value={policy.rolloutPercent}
                onChange={(e) => patch({ rolloutPercent: e.target.value })}
              />
            </Field>
          </div>
          <UpgradeRoute sources={sourceVersions} target={versionName} />
          <Collapsible>
            <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
              更多匹配条件
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <Field title="硬件版本">
                <Input
                  aria-label="硬件版本"
                  placeholder="多个版本用逗号分隔"
                  value={hardwareText}
                  onChange={(e) => setHardwareText(e.target.value)}
                />
              </Field>
              <Field title="设备标签" help="全部标签精确匹配，每行一个 名称=值。">
                <Textarea
                  aria-label="设备标签"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  placeholder="region=shanghai"
                />
              </Field>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              title="批次开始时间"
              help="仅本次设备支持预约，范围为 5 分钟至 7 天。持续匹配在激活后立即开始。"
            >
              <DateTimePicker
                label="批次开始时间"
                disabled={policy.mode === 'DYNAMIC'}
                value={start}
                onChange={setStart}
              />
            </Field>
            <Field
              title="批次截止时间"
              help="默认两天后截止；预约时从开始时间算起。可修改或清除，清除后批次不会自动截止。"
            >
              <DateTimePicker
                label="批次截止时间"
                value={end}
                onChange={setEnd}
              />
            </Field>
            <Field
              title="设备执行时间"
              help="留空表示收到任务后立即执行；设置后由设备按此时间处理。与批次匹配时间不同。"
            >
              <DateTimePicker
                label="设备执行时间"
                value={execute}
                onChange={setExecute}
              />
            </Field>
            <Field title="推送速率（台/分钟）">
              <Input
                aria-label="推送速率"
                type="number"
                min={1}
                value={policy.pushPerMinute}
                onChange={(e) => patch({ pushPerMinute: Number(e.target.value) })}
              />
            </Field>
          </div>
          <label
            htmlFor={confirmationId}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-input bg-muted/20 px-3.5 py-3 transition-colors hover:bg-muted/40 focus-within:border-ring/60"
          >
            <span className="min-w-0 space-y-1">
              <span id={confirmationId + '-label'} className="block text-sm font-medium">
                下发前需要业务确认
              </span>
              <span id={confirmationId + '-hint'} className="block text-xs text-muted-foreground">
                开启后，升级任务须在任务列表中确认，之后才会下发。
              </span>
            </span>
            <Switch
              id={confirmationId}
              aria-labelledby={confirmationId + '-label'}
              aria-describedby={confirmationId + '-hint'}
              checked={policy.requireAppConfirm}
              onCheckedChange={(checked) => patch({ requireAppConfirm: checked })}
            />
          </label>
          <Collapsible>
            <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
              高级推送策略
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field title="速率模式">
                  <Choice
                    label="速率模式"
                    value={policy.rateMode}
                    onValueChange={(v) => patch({ rateMode: v as ReleasePolicy['rateMode'] })}
                    options={[
                      { value: 'CONSTANT', label: '固定速率' },
                      { value: 'PROGRESSIVE', label: '按累计成功数递增' },
                    ]}
                  />
                </Field>
                <Field title="优先级" help="0–100，数值越大越优先，不抢占已下发任务。">
                  <Input
                    aria-label="优先级"
                    type="number"
                    min={0}
                    max={100}
                    value={policy.priority}
                    onChange={(e) => patch({ priority: Number(e.target.value) })}
                  />
                </Field>
              </div>
              {policy.rateMode === 'PROGRESSIVE' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  {(
                    [
                      ['rateThreshold', '每成功（台）'],
                      ['rateStep', '增加（台/分钟）'],
                      ['maxPushPerMinute', '上限（台/分钟）'],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} title={label}>
                      <Input
                        aria-label={label}
                        type="number"
                        min={1}
                        value={policy[key]}
                        onChange={(e) => patch({ [key]: Number(e.target.value) })}
                      />
                    </Field>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
      {step === 3 && (
        <dl className="grid gap-4 rounded-lg border p-5 text-sm sm:grid-cols-2">
          {[
            ['目标固件', `${moduleName} / ${versionName}`],
            ['批次描述', policy.description?.trim() || '—'],
            ['升级包', pkg?.packageName],
            [
              '设备范围',
              scope === 'all'
                ? '当前产品匹配设备'
                : scope === 'group'
                  ? `设备组 ${policy.groupId}`
                  : `指定 ${deviceIds.length} 台设备`,
            ],
            ['灰度比例', `${policy.rolloutPercent}%`],
            ['匹配方式', policy.mode === 'STATIC' ? '仅本次设备' : '持续匹配'],
            ['源版本', sourceVersions.join('、') || '不限制'],
            ['硬件版本', hardwareText || '不限制'],
            ['标签', tagText || '不限制'],
            ['开始 / 截止', `${start || '激活后立即'} / ${end || '不限制'}`],
            ['设备执行', execute || '立即执行'],
            ['业务确认', policy.requireAppConfirm ? '需要' : '不需要'],
            [
              '推送策略',
              policy.rateMode === 'CONSTANT'
                ? `${policy.pushPerMinute} 台/分钟`
                : `初始 ${policy.pushPerMinute}，每成功 ${policy.rateThreshold} 台加 ${policy.rateStep}，上限 ${policy.maxPushPerMinute}`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <Failure error={action.error} />
      {picker && (
        <ScopePicker
          projectId={projectId}
          productId={policy.productId}
          group={scope === 'group'}
          selected={
            scope === 'group' ? (policy.groupId ? [policy.groupId] : []) : deviceIds
          }
          onChange={(ids) => {
            if (scope === 'group') {
              patch({ groupId: ids[0] });
            } else if (deviceIdMode === 'text') {
              setDeviceIdText(ids.join('\n'));
            } else {
              patch({ deviceIds: ids });
            }
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </Modal>
  );
}
