import { v4 as uuidv4 } from 'uuid';
import { useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { commandPath, commandRequest, parseCommandInput, type CommandSubmission } from '@/api/device/commands';
import type { DeviceDetail } from '@/api/device/client';
import type { ThingModelAction } from '@/types/apps/open-platform';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ErrorNotice } from '@/components/iam/shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommandSelect } from './command-select';
import CommandField from './command-fields';
import { fieldError, initialValue, supportsForm } from './command-schema';

export function ActionControl({ projectId, device, actions, blocked, beforeSend, onSubmitted, busy, onBusyChange }: { projectId: string; device: DeviceDetail; actions: ThingModelAction[]; blocked: string; beforeSend: () => Promise<void>; onSubmitted: (result: CommandSubmission) => void; busy: boolean; onBusyChange: (busy: boolean) => void }) {
  const [code, setCode] = useState(actions[0]?.code ?? '');
  const action = actions.find(item => item.code === code);
  return <div className="space-y-4 p-4">
    <p className="text-xs leading-5 text-muted-foreground">调用一次设备动作，处理结果通过右侧指令回复显示。</p>
    {!actions.length ? <p className="py-8 text-center text-sm text-muted-foreground">物模型尚未定义动作。</p> : <>
      <CommandSelect label="选择设备动作" disabled={busy} value={code} onValueChange={setCode} options={actions.map(item => ({ value: item.code, label: `${item.title} · ${item.code}` }))} placeholder="选择动作" />
      {action && <ActionForm key={action.code} action={action} projectId={projectId} device={device} blocked={blocked} beforeSend={beforeSend} onSubmitted={onSubmitted} busy={busy} onBusyChange={onBusyChange} />}
    </>}
  </div>;
}
function ActionForm({ action, projectId, device, blocked, beforeSend, onSubmitted, busy, onBusyChange }: { action: ThingModelAction; projectId: string; device: DeviceDetail; blocked: string; beforeSend: () => Promise<void>; onSubmitted: (result: CommandSubmission) => void; busy: boolean; onBusyChange: (busy: boolean) => void }) {
  const [text, setText] = useState(() => JSON.stringify(initialValue(action.inputSchema) ?? {}, null, 2));
  const [json, setJson] = useState(!supportsForm(action.inputSchema));
  const [validation, setValidation] = useState('');
  const [error, setError] = useState<unknown>();
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const lock = useRef(false);
  let value: unknown = {};
  try { value = JSON.parse(text); } catch { /* Invalid draft remains editable. */ }
  function validate() {
    try {
      const input = parseCommandInput(text, true);
      const problem = fieldError(action.inputSchema, input);
      if (problem) throw new Error(problem);
      setValidation(''); return input;
    } catch (failure) { setValidation(failure instanceof Error ? failure.message : '请检查动作参数'); return null; }
  }
  async function send() {
    if (lock.current || busy || blocked) return;
    const input = validate(); if (!input) return;
    lock.current = true; onBusyChange(true); setError(undefined); setSubmissionUncertain(false);
    let submissionStarted = false;
    try {
      await beforeSend();
      const body = {
        actionCode: action.code, inputParams: JSON.stringify(input), clientToken: uuidv4(), deliveryTtlMs: 10000,
      };
      submissionStarted = true;
      const result = await commandRequest<CommandSubmission>(projectId, `${commandPath(device.deviceId)}/actions`, 'POST', body);
      onSubmitted(result); setConfirm(false);
    } catch (failure) { setError(failure); setSubmissionUncertain(submissionStarted); setConfirm(false); }
    finally { lock.current = false; onBusyChange(false); }
  }
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">动作入参</span><Button variant="ghost" size="sm" disabled={busy || !supportsForm(action.inputSchema)} onClick={() => { if (json && !validate()) return; setJson(!json); }}>{json ? '可视化填写' : 'JSON 编辑'}</Button></div>
    {json ? <Textarea aria-label="动作 JSON 参数" className="min-h-48 font-mono text-xs" disabled={busy} value={text} onChange={event => setText(event.target.value)} /> : <CommandField schema={action.inputSchema} label={action.title} value={value} disabled={busy} onChange={next => setText(JSON.stringify(next, null, 2))} />}
    <details><summary className="cursor-pointer text-xs text-muted-foreground">查看动作输出定义</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(action.outputSchema, null, 2)}</pre></details>
    {validation && <p role="alert" className="text-xs text-destructive">{validation}</p>}
    <ErrorNotice error={error} />{!!error && <p className="text-xs text-muted-foreground">{submissionUncertain ? '请求结果未确认，请先核对指令记录，勿自动重复调用。' : '动作尚未发送，请处理错误后重试。'}</p>}
    {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
    <Button disabled={busy || !!blocked} onClick={() => { if (validate()) setConfirm(true); }}><Send className="size-3.5" />调用动作</Button>
    <Dialog open={confirm} onOpenChange={open => { if (!busy) setConfirm(open); }}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>确认调用 {action.title}</DialogTitle><DialogDescription>将在设备「{device.deviceName}」执行一次动作，提交后等待设备回复。</DialogDescription></DialogHeader><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{text}</pre><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>返回修改</Button><Button disabled={busy || !!blocked} onClick={() => void send()}>{busy ? '正在提交…' : '确认调用'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
