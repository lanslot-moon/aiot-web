import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Compose the existing Base UI Select; option values stay strings so enum payloads
// can be mapped back to their original boolean/number/string type by the caller.
export function CommandSelect({ value, onValueChange, options, placeholder, id, label, disabled, onBlur, className }: {
  value: string; onValueChange: (value: string) => void;
  options: { value: string; label: string }[]; placeholder: string;
  id?: string; label?: string; disabled?: boolean; onBlur?: () => void; className?: string;
}) {
  return <Select value={value === '' ? null : value} disabled={disabled} items={options} onValueChange={next => { if (next !== null) onValueChange(next); }}>
    <SelectTrigger id={id} aria-label={label} onBlur={onBlur} className={cn('w-full min-w-0', className)}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent align="start" alignItemWithTrigger={false}>
      {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
