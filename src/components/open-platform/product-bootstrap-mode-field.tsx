import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  PRODUCT_BOOTSTRAP_MODE_DESCRIPTION,
  PRODUCT_BOOTSTRAP_MODE_LABEL,
} from '@/lib/open-platform-labels';
import { cn } from '@/lib/utils';

const BOOTSTRAP_MODE_OPTIONS = ['OPEN', 'STRICT'] as const;

type ProductBootstrapModeFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  productSecretEnabled: boolean;
  deviceSecretEnabled: boolean;
  error?: string;
  className?: string;
};

export function ProductBootstrapModeField({
  value,
  onValueChange,
  productSecretEnabled,
  deviceSecretEnabled,
  error,
  className,
}: ProductBootstrapModeFieldProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-background/60 p-3',
        error && 'border-destructive/60',
        className,
      )}
      aria-invalid={Boolean(error) || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">产品密钥注册模式</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            选择设备首次上线前是否需要提前登记 Hardware UUID。
          </p>
        </div>
        <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          {productSecretEnabled
            ? `当前：${PRODUCT_BOOTSTRAP_MODE_LABEL[value] ?? '未选择'}`
            : '未启用产品密钥'}
        </span>
      </div>

      {productSecretEnabled ? (
        <RadioGroup
          value={value}
          onValueChange={onValueChange}
          className="mt-3 grid gap-2 sm:grid-cols-2"
          aria-label="产品密钥注册模式"
        >
          {BOOTSTRAP_MODE_OPTIONS.map((code) => {
            const selected = value === code;
            return (
              <label
                key={code}
                htmlFor={`product-bootstrap-mode-${code.toLowerCase()}`}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-md border bg-background px-3 py-3 text-sm transition-colors hover:border-primary/40',
                  selected && 'border-primary bg-primary/5 ring-1 ring-primary/20',
                )}
              >
                <RadioGroupItem
                  id={`product-bootstrap-mode-${code.toLowerCase()}`}
                  value={code}
                  aria-describedby={`product-bootstrap-mode-${code.toLowerCase()}-description`}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block font-medium">{PRODUCT_BOOTSTRAP_MODE_LABEL[code]}</span>
                  <span
                    id={`product-bootstrap-mode-${code.toLowerCase()}-description`}
                    className="mt-1 block text-xs leading-5 text-muted-foreground"
                  >
                    {PRODUCT_BOOTSTRAP_MODE_DESCRIPTION[code]}
                  </span>
                </span>
              </label>
            );
          })}
        </RadioGroup>
      ) : (
        <div className="mt-3 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
          请先在上方勾选“产品密钥”，再选择动态注册或预注册。当前仅使用设备密钥时，将按设备密钥制造流程处理。
        </div>
      )}

      {productSecretEnabled && value === 'STRICT' && !deviceSecretEnabled ? (
        <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
          预注册可以先维护 Hardware UUID；如果要生成设备凭证、划拨或导出，还需要同时启用“设备密钥”。
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
