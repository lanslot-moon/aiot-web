import { request, segment, setSession } from '@/api/iam/client';
import type { PasswordResetResultVO } from '@/api/iam/contracts';
import { Action, ErrorNotice, FieldsForm, type Values } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { VERIFICATION_RESEND_SECONDS } from '@/components/iam/verification-policy';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { type Field } from '../../../components/iam/shared-utils';

const fields: Field[] = [
  {
    name: 'identifierType',
    label: '账号类型',
    options: [
      { value: 'USERNAME', label: '用户名' },
      { value: 'EMAIL', label: '邮箱' },
      { value: 'PHONE', label: '手机号' },
    ],
  },
  { name: 'identifier', label: '账号', required: true, maxLength: 128 },
  {
    name: 'deliveryMethod',
    label: '接收验证码',
    options: [
      { value: 'EMAIL', label: '邮箱' },
      { value: 'SMS', label: '短信' },
    ],
  },
];

export default function AuthForgotPassword() {
  const [result, setResult] = useState<PasswordResetResultVO | null>(null);
  const [application, setApplication] = useState<Values | null>(null);
  const [now, setNow] = useState(Date.now());
  const [resendAt, setResendAt] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const inFlight = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!result) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [result]);

  const expired = !!result && (!result.expiresAt || now >= result.expiresAt);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function apply(values: Values) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      const body = { ...values, identifier: values.identifier.trim() };
      const response = await request<PasswordResetResultVO>(
        '/api/v1/password-recovery-requests',
        'POST',
        body,
        { anonymous: true },
      );
      if (!response.resetId || !response.token || !response.expiresAt) {
        throw new Error('暂时无法开始密码重置，请稍后重试或联系管理员。');
      }
      const receivedAt = Date.now();
      setApplication(body);
      setResult(response);
      setNow(receivedAt);
      setResendAt(receivedAt + VERIFICATION_RESEND_SECONDS * 1000);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      {!result ? (
        <FieldsForm fullWidth fields={fields} label="发送验证码" onSave={apply} />
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            如果该账号已绑定所选接收方式，验证码将发送至对应邮箱或手机。
            {result.maskedTarget && `接收目标：${result.maskedTarget}`}
          </p>
          {expired && (
            <p role="alert" className="text-sm text-destructive">
              本次找回已过期，请重新发送验证码。
            </p>
          )}
          <FieldsForm
            key={result.resetId}
            fullWidth
            submitDisabled={expired || sending}
            onBusyChange={setSubmitting}
            fields={[
              {
                name: 'verificationCode',
                label: '验证码',
                required: true,
                minLength: 6,
                maxLength: 6,
                autoComplete: 'one-time-code',
              },
              {
                name: 'newPassword',
                label: '新密码',
                required: true,
                type: 'password',
                minLength: 8,
                maxLength: 128,
                autoComplete: 'new-password',
              },
              {
                name: 'confirmation',
                label: '确认新密码',
                required: true,
                type: 'password',
                autoComplete: 'new-password',
              },
            ]}
            label="重置密码"
            onSave={async (values) => {
              if (Date.now() >= (result.expiresAt ?? 0))
                throw new Error('本次找回已过期，请重新发送验证码。');
              if (!/^\d{6}$/.test(values.verificationCode))
                throw new Error('请输入六位数字验证码。');
              if (values.newPassword !== values.confirmation)
                throw new Error('两次输入的新密码不一致。');
              await request(
                `/api/v1/password-recovery-requests/${segment(result.resetId)}`,
                'PUT',
                {
                  identifier: application?.identifier,
                  token: result.token,
                  verificationCode: values.verificationCode,
                  newPassword: values.newPassword,
                },
                { anonymous: true },
              );
              setSession(null);
            }}
            afterSave={() => {
              setResult(null);
              setApplication(null);
              navigate('/auth/auth2/login', { replace: true });
              toast.success('密码已重置，请重新登录。');
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={sending || submitting || remaining > 0}
              onClick={() => {
                if (application && !sending && !submitting && Date.now() >= resendAt) {
                  void apply(application).catch(setError);
                }
              }}
            >
              {sending
                ? '正在发送…'
                : remaining > 0
                  ? `${remaining} 秒后重新发送`
                  : '重新发送验证码'}
            </Button>
            {!sending && !submitting && (
              <Action
                label="更换账号"
                description="将结束本次找回流程，并清除已填写的验证码和新密码。"
                run={async () => {
                  setResult(null);
                  setApplication(null);
                  setError(null);
                }}
              />
            )}
          </div>
          <ErrorNotice error={error} />
        </>
      )}
      <Link className="text-sm hover:underline" to="/auth/auth2/login">
        返回登录
      </Link>
    </div>
  );
}
