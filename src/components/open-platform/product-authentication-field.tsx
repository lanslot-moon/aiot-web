import { useId } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'DEVICE_SECRET', title: '设备密钥', description: '提前生成设备凭证，烧录后首次接入。' },
  { value: 'STRICT', title: '预注册', description: '先登记 UUID；设备用产品密钥注册，领取设备密钥。' },
  { value: 'OPEN', title: '动态注册', description: '无需登记 UUID；设备用产品密钥注册，领取设备密钥。' },
  { value: 'CUSTOM', title: '自定义认证', description: '由已配置的认证提供方处理首次接入。' },
];

type Props = {
  authMode: string;
  bootstrapMode: string;
  onChange: (authMode: string, bootstrapMode: string) => void;
  error?: string;
  className?: string;
};

export function ProductAuthenticationField({ authMode, bootstrapMode, onChange, error, className }: Props) {
  const id = useId();
  const value = authMode === 'PRODUCT_SECRET' ? bootstrapMode : authMode;
  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="text-sm font-medium">首次接入方式 <span className="text-destructive">*</span></legend>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">每个产品选择一种方式，发布后不可修改。</p>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next === 'OPEN' || next === 'STRICT' ? 'PRODUCT_SECRET' : next, next === 'OPEN' || next === 'STRICT' ? next : '')}
        aria-label="首次接入方式"
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        aria-invalid={Boolean(error) || undefined}
        className="grid gap-2 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => (
          <label key={option.value} htmlFor={`${id}-${option.value}`} className={cn('flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-3 transition-colors hover:border-primary/50 has-focus-visible:ring-2 has-focus-visible:ring-ring', value === option.value && 'border-primary bg-primary/5')}>
            <RadioGroupItem id={`${id}-${option.value}`} value={option.value} className="mt-0.5" aria-describedby={`${id}-${option.value}-description`} />
            <span><span className="block text-sm font-medium">{option.title}</span><span id={`${id}-${option.value}-description`} className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span></span>
          </label>
        ))}
      </RadioGroup>
      {error ? <p id={`${id}-error`} className="text-xs text-destructive">{error}</p> : null}
    </fieldset>
  );
}
