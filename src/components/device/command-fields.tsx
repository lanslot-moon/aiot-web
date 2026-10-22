import { useId, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { InputNumber, Slider, Switch as AntSwitch } from 'antd';
import { CommandSelect } from './command-select';
import { Switch } from '@/components/ui/switch';
import { DeviceInput } from './layout';
import { cn } from '@/lib/utils';
import { canRepresent, fieldError, fieldsOf, initialValue, schemaObject, schemaType, supportsForm } from './command-schema';

export default function CommandField({ schema, value, onChange, label, disabled = false, inline = false, controlPanel = false }: {
  schema: unknown; value: unknown; onChange: (value: unknown) => void; label: string; disabled?: boolean; inline?: boolean; controlPanel?: boolean;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const definition = schemaObject(schema);
  const type = schemaType(schema);
  const composite = type === 'object' || type === 'array';
  const horizontal = inline && !composite;
  const error = fieldError(schema, value);
  const hint = [definition.description, definition.unit, typeof definition.minimum === 'number' ? `最小 ${definition.minimum}` : '', typeof definition.maximum === 'number' ? `最大 ${definition.maximum}` : ''].filter(item => typeof item === 'string' && item).join(' · ');
  let control;
  if (!supportsForm(schema)) control = <p className="text-xs text-muted-foreground">此参数包含复杂定义，请切换高级模式填写。</p>;
  else if (Array.isArray(definition.enum)) {
    const options = definition.enum.map((item, index) => ({ value: String(index), label: String(item) }));
    const index = definition.enum.findIndex(item => Object.is(item, value));
    control = <CommandSelect id={id} label={label} value={index < 0 ? '' : String(index)} options={options} placeholder="请选择" disabled={disabled} onBlur={() => setTouched(true)} onValueChange={next => onChange((definition.enum as unknown[])[Number(next)])} />;
  }
  else if (type === 'boolean') control = controlPanel
    ? <div className="flex min-h-8 items-center justify-end"><AntSwitch id={id} checked={value === true} disabled={disabled} onChange={onChange} checkedChildren="开" unCheckedChildren="关" aria-describedby={`${id}-hint`} /></div>
    : <div className="flex min-h-9 items-center gap-3"><Switch id={id} checked={value === true} disabled={disabled} onCheckedChange={onChange} aria-describedby={`${id}-hint`} /><span className="text-sm">{value === true ? '开启' : '关闭'}</span></div>;
  else if (type === 'object') {
    const object = schemaObject(value);
    const fields = Object.entries(fieldsOf(schema));
    const visible = fields.filter(([key]) => Object.prototype.hasOwnProperty.call(object, key) || (Array.isArray(definition.required) && definition.required.includes(key)));
    const available = fields.filter(([key, child]) => !visible.some(([shown]) => shown === key) && supportsForm(child));
    control = <div className="min-w-0">
      <div className="divide-y divide-border/50">{visible.map(([key, childSchema]) => {
        const required = Array.isArray(definition.required) && definition.required.includes(key);
        const title = typeof schemaObject(childSchema).title === 'string' ? String(schemaObject(childSchema).title) : key;
        return <div key={key} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><CommandField inline controlPanel={controlPanel} schema={childSchema} label={`${title}${required ? ' *' : ''}`} value={Object.prototype.hasOwnProperty.call(object, key) ? object[key] : initialValue(childSchema)} disabled={disabled} onChange={next => onChange({ ...object, [key]: next })} /></div>{!required && <Button variant="ghost" size="icon" className="size-8! shrink-0 text-muted-foreground" disabled={disabled} aria-label={`移除${title}`} onClick={() => { const next = { ...object }; delete next[key]; onChange(next); }}><Trash2 className="size-3.5" /></Button>}</div>;
      })}</div>
      {!visible.length && <p className="py-2 text-xs text-muted-foreground">{fields.length ? '添加需要下发的属性' : '此动作无需输入参数'}</p>}
      {available.length > 0 && <div className="pt-2"><CommandSelect label="添加属性或参数" value="" disabled={disabled} placeholder={Array.isArray(definition.required) ? '添加可选参数' : '添加属性'} options={available.map(([key, child]) => ({ value: key, label: String(schemaObject(child).title ?? key) }))} onValueChange={key => onChange({ ...object, [key]: initialValue(fieldsOf(schema)[key]) })} /></div>}

    </div>;
  } else if (type === 'array') {
    const items = Array.isArray(value) ? value : [];
    control = <div className="space-y-2"><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{items.length ? `${items.length} 项` : '暂无条目'}</span><Button variant="outline" size="sm" className="h-7! gap-1 px-2! text-xs!" disabled={disabled || (typeof definition.maxItems === 'number' && items.length >= definition.maxItems)} onClick={() => onChange([...items, initialValue(definition.items)])}><Plus className="size-3.5" />添加一项</Button></div>{items.map((item, index) => <div key={index} className="flex items-start gap-2 rounded-md border bg-muted/15 p-2"><div className="min-w-0 flex-1"><CommandField inline controlPanel={controlPanel} schema={definition.items} value={item} label={`第 ${index + 1} 项`} disabled={disabled} onChange={next => onChange(items.map((old, i) => i === index ? next : old))} /></div><Button variant="ghost" size="icon" className="size-7! shrink-0 text-muted-foreground" disabled={disabled} aria-label={`删除第 ${index + 1} 项`} onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 className="size-3.5" /></Button></div>)}</div>;
  } else control = <DeviceInput id={id} type={type === 'number' || type === 'integer' ? 'number' : 'text'} value={typeof value === 'string' || typeof value === 'number' ? value : ''} min={typeof definition.minimum === 'number' ? definition.minimum : undefined} max={typeof definition.maximum === 'number' ? definition.maximum : undefined} step={type === 'integer' ? 1 : 'any'} disabled={disabled} onBlur={() => setTouched(true)} aria-invalid={touched && !!error} aria-describedby={`${id}-hint`} onChange={event => onChange(type === 'number' || type === 'integer' ? event.target.value === '' ? '' : Number(event.target.value) : event.target.value)} />;
  if (controlPanel && !Array.isArray(definition.enum) && supportsForm(schema) && (type === 'number' || type === 'integer')) {
    const numeric = typeof value === 'number' ? value : undefined;
    const min = typeof definition.minimum === 'number' ? definition.minimum : undefined;
    const max = typeof definition.maximum === 'number' ? definition.maximum : undefined;
    const step = typeof definition.multipleOf === 'number' && definition.multipleOf > 0 ? definition.multipleOf : type === 'integer' ? 1 : 0.1;
    control = <div className="flex min-h-8 items-center gap-3">
      {min !== undefined && max !== undefined && max > min && <Slider className="min-w-0 flex-1" ariaLabelForHandle={`${label}滑块`} value={numeric ?? min} min={min} max={max} step={step} disabled={disabled} onChange={onChange} />}
      <InputNumber id={id} className={cn('shrink-0', min !== undefined && max !== undefined ? 'w-24!' : 'w-full!')} value={numeric ?? null} placeholder="未设置" min={min} max={max} step={step} precision={type === 'integer' ? 0 : undefined} suffix={typeof definition.unit === 'string' ? definition.unit : undefined} disabled={disabled} onBlur={() => setTouched(true)} status={touched && error ? 'error' : undefined} aria-invalid={touched && !!error} aria-describedby={`${id}-hint`} onChange={next => onChange(next ?? '')} />
    </div>;
  }
  const titleParts = label.split(' · ');
  return <Field orientation={horizontal ? 'horizontal' : 'vertical'} data-invalid={touched && !!error} className={cn('min-w-0 gap-2', horizontal && 'grid! grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] items-center gap-x-4', controlPanel && !composite && 'min-h-8 items-center! gap-x-2', composite && 'gap-2!')}>
    <div className={cn('min-w-0 space-y-0.5', controlPanel && !composite && 'flex flex-wrap items-baseline gap-x-1.5 gap-y-0')}><FieldLabel className="text-sm font-medium" htmlFor={composite ? undefined : id}>{titleParts[0]}</FieldLabel>{titleParts[1] && <FieldDescription className="break-all font-mono text-[11px] leading-4">{titleParts[1]}</FieldDescription>}</div>
    <FieldContent title={controlPanel ? hint : undefined} className={cn('min-w-0', type === 'object' && 'col-span-full')}>
      {control}
      <div id={`${id}-hint`}>{hint && (controlPanel ? <span className="sr-only">{hint}</span> : <FieldDescription className="text-xs">{hint}</FieldDescription>)}{touched && error && !['object', 'array'].includes(type) && canRepresent(schema, value) && <FieldError className="text-xs">{error}</FieldError>}</div>
    </FieldContent>
  </Field>;
}
