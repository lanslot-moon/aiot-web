import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Compose the existing Base UI Select; option values stay strings so enum payloads
// can be mapped back to their original boolean/number/string type by the caller.
export function CommandSelect({ value, onValueChange, options, placeholder, id, label, disabled, onBlur, className, expandedOptions = false }: {
  value: string; onValueChange: (value: string) => void;
  options: { value: string; label: string }[]; placeholder: string;
  id?: string; label?: string; disabled?: boolean; onBlur?: () => void; className?: string; expandedOptions?: boolean;
}) {
  return <Select value={value === '' ? null : value} disabled={disabled} items={options} onValueChange={next => { if (next !== null) onValueChange(next); }}>
    <SelectTrigger id={id} aria-label={label} onBlur={onBlur} className={cn('w-full min-w-0', className)}>
      {expandedOptions ? <SelectValue className="min-w-0 overflow-hidden" placeholder={placeholder}><span className="truncate" title={options.find(option => option.value === value)?.label}>{options.find(option => option.value === value)?.label ?? placeholder}</span></SelectValue> : <SelectValue placeholder={placeholder} />}
    </SelectTrigger>
    <SelectContent align="start" alignItemWithTrigger={false} className={cn(expandedOptions && 'w-max min-w-(--anchor-width) max-w-[min(36rem,calc(100vw-2rem))]')}>
      {options.map(option => <SelectItem key={option.value} value={option.value} className={cn(expandedOptions && 'items-start py-2 [&>span]:min-w-0 [&>span]:shrink')}><span className={cn(expandedOptions && 'min-w-0 whitespace-normal [overflow-wrap:anywhere]')}>{option.label}</span></SelectItem>)}
    </SelectContent>
  </Select>;
}
