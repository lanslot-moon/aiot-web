import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function SearchFieldSelect<Field extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  options: { value: Field; label: string }[];
  value: Field;
  onChange: (value: Field) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger
        aria-label={label}
        className={cn('relative shrink-0 rounded-l-lg! rounded-r-none! border-r-0 text-xs! focus-visible:z-10', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="rounded-lg! p-1">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="rounded-md! text-xs!">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
