import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const timeOptions = {
  小时: Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')),
  分钟: Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')),
};

function TimeSelect({ label, value, onChange }: {
  label: keyof typeof timeOptions;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => { if (next !== null) onChange(next); }}>
      <SelectTrigger aria-label={label} className="w-full tabular-nums">
        <SelectValue />
        <span className="text-xs text-muted-foreground">{label}</span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-52 min-w-(--anchor-width) rounded-lg! p-1">
        {timeOptions[label].map((option) => (
          <SelectItem key={option} value={option} className="rounded-md! tabular-nums">
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateTimePicker({ label, value, onChange, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date>();
  const [hour, setHour] = useState('00');
  const [minute, setMinute] = useState('00');
  const displayValue = value.replace('T', ' ');

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          const selected = value ? parseISO(value) : undefined;
          const time = selected ?? new Date();
          setDay(selected);
          setHour(format(time, 'HH'));
          setMinute(format(time, 'mm'));
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger
        render={<Button type="button" variant="outline" disabled={disabled} />}
        aria-label={displayValue ? `${label} ${displayValue}` : label}
        className={cn(
          'h-9! w-full justify-between gap-2 rounded-lg! px-2.5 font-normal tabular-nums dark:bg-input/30',
          !displayValue && 'text-muted-foreground',
        )}
      >
        {displayValue || '选择日期和时间'}
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-(--available-height) max-w-(--available-width) gap-2 overflow-y-auto rounded-xl! p-3">
        <PopoverTitle className="px-1 text-sm">{label}</PopoverTitle>
        <Calendar
          mode="single"
          required
          locale={zhCN}
          selected={day}
          defaultMonth={day}
          onSelect={setDay}
          className="mx-auto p-0"
        />
        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <TimeSelect label="小时" value={hour} onChange={setHour} />
          <TimeSelect label="分钟" value={minute} onChange={setMinute} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Button type="button" variant="ghost" size="sm" disabled={!value && !day} onClick={() => {
            onChange('');
            setOpen(false);
          }}>
            清除
          </Button>
          <Button type="button" size="sm" disabled={!day} onClick={() => {
            if (!day) return;
            onChange(`${format(day, 'yyyy-MM-dd')}T${hour}:${minute}`);
            setOpen(false);
          }}>
            确定
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
