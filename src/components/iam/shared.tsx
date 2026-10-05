import { OpenPlatformApiError } from '@/api/iam/client';
import type { CursorResult } from '@/api/iam/contracts';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePermission } from '../../context/iam-context/identity';
import { ErrorNotice } from './error-notice';
import { FieldValidationError, isValidEmail } from './form-validation';
import { FieldError } from '@/components/ui/field';
import { Field, statusOptions, useResource } from './shared-utils';

import { GatewayDataTable as DataTable } from '@/components/tables/data-table/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
export { GatewayDataTable as DataTable } from '@/components/tables/data-table/DataTable';
export { ErrorNotice } from './error-notice';

import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { cn } from '@/lib/utils';
import { clearDraft, useDraftRegistration } from './drafts';

export function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
      正在加载…
    </div>
  );
}
export function Page({
  title,
  description,
  children,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { title: string; to?: string }[];
}) {
  useEffect(() => {
    document.title = `${title} · AIoT`;
  }, [title]);
  return (
    <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4">
      <BreadcrumbComp title={title} items={breadcrumbs} />
      <StyleDivider />
      <div className="space-y-5 bg-background p-4 md:p-6">
        {(description || actions) && <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>}
        {children}
      </div>
    </StyleAwareWrapper>
  );
}
export function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-wrap flex-row items-start justify-between gap-3 border-b py-4">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions}
        </CardHeader>
        <CardContent className="space-y-4 py-4">{children}</CardContent>
      </Card>
  );
}
export function SecretInput({
  id,
  name,
  value,
  onChange,
  autoComplete = 'off',
  readOnly = false,
  ...accessibility
}: {
  id?: string;
  name?: string;
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  autoComplete?: string;
  readOnly?: boolean;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...accessibility}
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        autoComplete={autoComplete}
        readOnly={readOnly}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0"
        aria-label={visible ? '隐藏内容' : '显示内容'}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
export type Values = Record<string, string>;

function validateField(field: Field, value: string, values: Values) {
  if (field.required && !value.trim()) return `请填写${field.label}`;
  if (value && field.minLength && value.length < field.minLength)
    return `${field.label}至少需要 ${field.minLength} 个字符`;
  if (field.maxLength && value.length > field.maxLength)
    return `${field.label}最多 ${field.maxLength} 个字符`;
  if (field.type === 'email' && value && !isValidEmail(value))
    return '请输入有效的邮箱地址。';
  if (field.type === 'number' && value && (!Number.isFinite(Number(value)) || Number(value) < 0))
    return '请输入非负数字';
  return field.validate?.(value, values);
}

export function FieldsForm({
  fields,
  initial = {},
  label = '保存',
  onSave,
  afterSave,
  children,
  fullWidth = false,
  onDirtyChange,
  onBusyChange,
  danger = false,
  submitDisabled = false,
  onFieldChange,
  fieldActions,
  fieldErrors = {},
  errorToFields,
  compactErrors = false,
  clearFieldErrorsOnChange = {},
}: {
  fields: Field[];
  initial?: Values;
  label?: string;
  onSave: (values: Values) => Promise<unknown>;
  afterSave?: () => void;
  children?: ReactNode;
  fullWidth?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  danger?: boolean;
  submitDisabled?: boolean;
  onFieldChange?: (name: string, value: string) => void;
  fieldActions?: Record<string, (values: Values, busy: boolean) => ReactNode>;
  fieldErrors?: Values;
  errorToFields?: (error: unknown) => Values;
  compactErrors?: boolean;
  clearFieldErrorsOnChange?: Record<string, string[]>;
}) {
  const prefix = useId();
  const [values, setValues] = useState<Values>(() => ({
    ...Object.fromEntries(fields.map((f) => [f.name, f.options?.[0]?.value ?? ''])),
    ...initial,
  }));
  const [invalid, setInvalid] = useState<Values>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [baseline, setBaseline] = useState<Values>(values);
  const dirty = Object.entries(values).some(([key, value]) => value !== baseline[key]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const draftId = useDraftRegistration(dirty && !busy);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || submitDisabled) return;
    const errors: Values = {};
    for (const field of fields) {
      const value = values[field.name] ?? '';
      const message = validateField(field, value, values);
      if (message) errors[field.name] = message;
    }
    setInvalid(errors);
    if (Object.keys(errors).length) {
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(errors)[0]}"]`)?.focus();
      return;
    }
    setBusy(true);
    busyRef.current = true;
    setError(null);
    try {
      clearDraft(draftId);
      await onSave(values);
      setBaseline({ ...values });
      toast.success(`${label}成功`);
      afterSave?.();
    } catch (failure) {
      const fieldNames = new Set(fields.map((field) => field.name));
      const errors = failure instanceof FieldValidationError
        ? { [failure.field]: failure.message }
        : failure instanceof OpenPlatformApiError
          ? Object.fromEntries(failure.errors.filter((entry) => fieldNames.has(entry.field))
              .map((entry) => [entry.field, entry.message]))
          : {};
      const resolved = { ...errors, ...errorToFields?.(failure) };
      const relevant = Object.fromEntries(Object.entries(resolved).filter(([name]) => fieldNames.has(name)));
      setInvalid(relevant);
      setError(Object.keys(relevant).length ? null : failure);
      const first = Object.keys(relevant)[0];
      if (first) window.requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      });
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  return (
    <form ref={formRef} noValidate onSubmit={submit} className="space-y-4" aria-busy={busy}>
      {fields.map((field) => {
        const id = `${prefix}-${field.name}`;
        const message = invalid[field.name] || fieldErrors[field.name];
        const update = (value: string) => {
          const nextValues = { ...values, [field.name]: value };
          setValues(nextValues);
          setInvalid((prev) => {
            const nextInvalid = {
              ...prev,
              [field.name]: value || prev[field.name] ? (validateField(field, value, nextValues) ?? '') : '',
            };
            for (const dependent of clearFieldErrorsOnChange[field.name] ?? [])
              nextInvalid[dependent] = '';
            return nextInvalid;
          });
          onFieldChange?.(field.name, value);
        };
        const validateCurrentField = () => {
          const fieldMessage = validateField(field, values[field.name] ?? '', values);
          setInvalid((prev) => ({ ...prev, [field.name]: fieldMessage ?? '' }));
        };
        const props = {
          id,
          name: field.name,
          value: values[field.name] ?? '',
          maxLength: field.maxLength,
          'aria-invalid': !!message,
          'aria-describedby': [message && `${id}-error`, field.hint && `${id}-help`].filter(Boolean).join(' ') || undefined,
          required: field.required,
          disabled: busy,
          onBlur: validateCurrentField,
        };
        return (
          <div key={field.name} className="space-y-1.5">
            <div className="flex min-h-5 items-start justify-between gap-2">
              <Label htmlFor={id} className={cn('shrink-0', fullWidth && 'text-sm font-normal text-muted-foreground')}>
                {field.label}{field.required ? ' *' : ''}
              </Label>
              {message && <FieldError id={`${id}-error`} className="min-w-0 text-right text-xs leading-5 break-words">{message}</FieldError>}
            </div>
            <div
              className={cn(
                fieldActions?.[field.name] &&
                  'flex items-center gap-2 [&>input]:min-w-0 [&>input]:flex-1',
              )}
            >
              {field.options ? (
                <Select
                  disabled={busy}
                  value={values[field.name]}
                  onValueChange={(v) => update(v ?? '')}
                  items={field.options}
                >
                  <SelectTrigger
                    id={id}
                    name={field.name}
                    className="w-full"
                    aria-invalid={!!message}
                    aria-describedby={props['aria-describedby']}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === 'password' ? (
                <SecretInput {...props} onChange={update} autoComplete={field.autoComplete} />
              ) : field.type === 'textarea' ? (
                <Textarea
                  {...props}
                  className="min-h-24 resize-none"
                  onChange={(e) => update(e.target.value)}
                />
              ) : (
                <Input
                  {...props}
                  type={field.type ?? 'text'}
                  maxLength={field.maxLength}
                  autoComplete={field.autoComplete}
                  onChange={(e) => update(e.target.value)}
                />
              )}
              {fieldActions?.[field.name]?.(values, busy)}
            </div>
            {field.hint && <p id={`${id}-help`} className="text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        );
      })}
      {children}
      {compactErrors && error && (!(error instanceof OpenPlatformApiError) || [400, 409].includes(error.status))
        ? <FieldError className="text-xs">{error instanceof Error ? error.message : '操作失败，请重试。'}</FieldError>
        : <ErrorNotice error={error} />}
      <Button
        className={cn('min-w-24', fullWidth && 'w-full')}
        variant={danger ? 'destructive' : 'default'}
        type="submit"
        disabled={busy || submitDisabled}
      >
        {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
        {label}
      </Button>
    </form>
  );
}
export function Action({
  label,
  description,
  fields = [],
  initial,
  run,
  done,
  danger = false,
  permission,
  children,
}: {
  label: string;
  description?: string;
  fields?: Field[];
  initial?: Values;
  run: (values: Values) => Promise<unknown>;
  done?: () => void;
  danger?: boolean;
  permission?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const allowed = usePermission(permission);
  return (
    <>
      <Button
        type="button"
        variant={danger ? 'destructive' : 'outline'}
        disabled={!allowed}
        title={!allowed ? '当前账号没有此操作权限' : undefined}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          if (!next && dirty) setDiscard(true);
          else setOpen(next);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {description ?? '填写信息后保存，服务端将校验操作权限。'}
            </DialogDescription>
          </DialogHeader>
          <FieldsForm
            fields={fields}
            onDirtyChange={setDirty}
            onBusyChange={setPending}
            danger={danger}
            initial={initial}
            label={label}
            onSave={run}
            afterSave={() => {
              setOpen(false);
              done?.();
            }}
          >
            {children}
          </FieldsForm>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              autoFocus={danger}
              onClick={() => (dirty ? setDiscard(true) : setOpen(false))}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>放弃填写内容？</DialogTitle>
            <DialogDescription>关闭后，本次填写的内容不会保存。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button autoFocus variant="outline" onClick={() => setDiscard(false)}>
              继续填写
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscard(false);
                setOpen(false);
              }}
            >
              放弃内容
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function CursorTable<T>({
  path,
  columns,
  permission,
  filters = false,
}: {
  path: string;
  columns: { label: string; render: (row: T) => ReactNode }[];
  permission?: string;
  filters?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const suffix = new URLSearchParams();
  const key = `list:${path}`;
  const cursor = params.get(`${key}:cursor`);
  const keyword = params.get(`${key}:keyword`);
  const status = params.get(`${key}:status`);
  if (cursor) suffix.set('cursor', cursor);
  if (keyword) suffix.set('keyword', keyword);
  if (status) suffix.set('status', status);
  const [draft, setDraft] = useState(keyword ?? '');
  const composing = useRef(false);
  useEffect(() => setDraft(keyword ?? ''), [keyword]);
  const resource = useResource<CursorResult<T>>(`${path}${path.includes('?') ? '&' : '?'}${suffix}`, permission);
  const allowed = usePermission(permission);
  function update(name: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(`${key}:${name}`, value);
      else next.delete(`${key}:${name}`);
      if (name !== 'cursor') next.delete(`${key}:cursor`);
      return next;
    });
  }
  return (
    <div className="space-y-3">
      {filters && (
        <form
          noValidate
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (composing.current) return;
            update('keyword', draft.trim());
          }}
        >
          <Label className="sr-only" htmlFor="iam-search">
            搜索项目
          </Label>
          <Input
            id="iam-search"
            className="w-56"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.nativeEvent.isComposing || composing.current))
                e.preventDefault();
            }}
            placeholder="搜索项目名称"
          />
          {draft && (
            <Button
              type="button"
              variant="ghost"
              aria-label="清除搜索"
              onClick={() => {
                setDraft('');
                update('keyword', '');
                document.getElementById('iam-search')?.focus();
              }}
            >
              <X />
            </Button>
          )}
          <Button type="submit" variant="outline">
            搜索
          </Button>
          <Select
            value={status ?? 'ALL'}
            onValueChange={(value) => update('status', value === 'ALL' ? '' : (value ?? ''))}
            items={statusOptions}
          >
            <SelectTrigger aria-label="项目状态">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </form>
      )}
      {!allowed ? (
        <ErrorNotice
          error={new OpenPlatformApiError('FORBIDDEN', '当前账号没有查看此列表的权限。', 403)}
        />
      ) : resource.isLoading ? (
        <Loading />
      ) : (
        <>
          <ErrorNotice error={resource.error} retry={() => resource.mutate()} />
          {!resource.error && <DataTable rows={resource.data?.items ?? []} columns={columns} />}
        </>
      )}
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>本页 {resource.data?.items.length ?? 0} 条</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!cursor || resource.isLoading}
            onClick={() => update('cursor', '')}
          >
            返回首页
          </Button>
          <Button
            variant="outline"
            disabled={!resource.data?.hasMore || resource.isLoading}
            onClick={() => update('cursor', resource.data?.nextCursor ?? '')}
          >
            下一页
          </Button>
          <Button
            variant="ghost"
            disabled={resource.isValidating}
            onClick={() => void resource.mutate()}
          >
            刷新
          </Button>
        </div>
      </div>
    </div>
  );
}
const labels: Record<string, string> = {
  ACTIVE: '启用',
  DISABLED: '停用',
  SUSPENDED: '暂停',
  ARCHIVED: '已归档',
  CLOSED: '已关闭',
  PENDING: '待处理',
  ACCEPTED: '已接受',
  REJECTED: '已拒绝',
  APPROVED: '已批准',
  REVOKED: '已吊销',
  EXPIRED: '已过期',
  CANCELLED: '已撤回',
};
export function Status({ value }: { value?: string | null }) {
  return (
    <span className="inline-flex rounded-md border px-2 py-0.5 text-xs">
      {value ? (labels[value] ?? value) : '—'}
    </span>
  );
}
export function Navigation({ links }: { links: { to: string; label: string }[] }) {
  const location = useLocation();
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
      aria-label="页面导航"
    >
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          aria-current={location.pathname === link.to ? 'page' : undefined}
          className={cn(
            'shrink-0 rounded-md px-3 py-2 text-sm hover:bg-muted focus-visible:outline focus-visible:outline-ring',
            location.pathname === link.to && 'bg-background font-medium',
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
