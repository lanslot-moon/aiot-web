import { post, put } from '@/api/iam/client';
import type { AccountVO, VerificationChallengeVO } from '@/api/iam/contracts';
import { useEffect, useRef, useState } from 'react';
import { useIam } from '../../context/iam-context/identity';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldsForm } from './shared';
import { epoch } from './shared-utils';
import { VERIFICATION_RESEND_SECONDS } from './verification-policy';

export function ContactChangeAction({ type, current }: { type: 'EMAIL' | 'PHONE'; current?: string | null }) {
  const { account, authorization } = useIam();
  const [open, setOpen] = useState(false);
  const [challenge, setChallenge] = useState<VerificationChallengeVO | null>(null);
  const [target, setTarget] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const resendAt = useRef(0);
  const isEmail = type === 'EMAIL';
  const contactName = isEmail ? '邮箱' : '手机号';
  const label = `${current ? '更换' : '绑定'}${contactName}`;
  const allowed = authorization.data?.permissionCodes.includes('account:update');

  useEffect(() => {
    if (!open) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else setOpen(false);
  };

  return <>
    <Button type="button" variant="outline" disabled={!allowed} onClick={() => {
      setChallenge(null);
      setTarget('');
      setDirty(false);
      setOpen(true);
    }}>{label}</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{challenge ? `请输入发送到 ${target} 的验证码，并验证当前密码。` : `输入${current ? '新' : ''}${contactName}，验证后保存。`}</DialogDescription>
        </DialogHeader>
        {!challenge ? <FieldsForm
          key="target"
          fields={[{ name: 'target', label: current ? `新${contactName}` : contactName, type: isEmail ? 'email' : undefined, required: true, maxLength: isEmail ? 128 : 32, autoComplete: isEmail ? 'email' : 'tel' }]}
          initial={{ target }}
          label={remaining > 0 ? `${remaining} 秒后可发送` : '发送验证码'}
          submitDisabled={remaining > 0}
          onDirtyChange={setDirty}
          onBusyChange={setBusy}
          onSave={async ({ target: value }) => {
            const destination = value.trim();
            if (destination === current) throw new Error(`请输入与当前${contactName}不同的${contactName}。`);
            const result = await post<VerificationChallengeVO>('/api/v1/verification-challenges', {
              channel: isEmail ? 'EMAIL' : 'SMS',
              purpose: isEmail ? 'CHANGE_EMAIL' : 'CHANGE_PHONE',
              target: destination,
            });
            if (!result.verificationId) throw new Error('未获取到验证码信息，请重试。');
            setTarget(destination);
            resendAt.current = Date.now() + VERIFICATION_RESEND_SECONDS * 1000;
            setRemaining(VERIFICATION_RESEND_SECONDS);
            setChallenge(result);
          }}
        /> : <>
          {challenge.expiresAt && <p className="text-sm text-muted-foreground">验证码有效期至 {epoch(challenge.expiresAt)}</p>}
          <FieldsForm
            key={challenge.verificationId}
            fields={[
              { name: 'code', label: '验证码', required: true, maxLength: 16, autoComplete: 'one-time-code' },
              { name: 'currentPassword', label: '当前密码', type: 'password', required: true, maxLength: 128, autoComplete: 'current-password' },
            ]}
            label={label}
            onDirtyChange={setDirty}
            onBusyChange={setBusy}
            onSave={async (values) => {
              if (challenge.expiresAt && Date.now() >= challenge.expiresAt) throw new Error('验证码已过期，请重新获取。');
              await put<AccountVO>('/api/v1/accounts/current/contact-info', {
                ...values, type, target, verificationId: challenge.verificationId,
              });
            }}
            afterSave={() => { setOpen(false); void account.mutate(); }}
          />
          <Button type="button" variant="ghost" disabled={busy} onClick={() => { setChallenge(null); setDirty(false); }}>重新填写{contactName}</Button>
        </>}
        <DialogFooter><Button type="button" variant="ghost" disabled={busy} onClick={close}>取消</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={discard} onOpenChange={setDiscard}>
      <DialogContent>
        <DialogHeader><DialogTitle>放弃填写内容？</DialogTitle><DialogDescription>关闭后，本次填写的内容不会保存。</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" autoFocus onClick={() => setDiscard(false)}>继续填写</Button>
          <Button type="button" variant="destructive" onClick={() => { setDiscard(false); setOpen(false); }}>放弃内容</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
