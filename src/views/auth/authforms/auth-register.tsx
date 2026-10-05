import { OpenPlatformApiError, request } from '@/api/iam/client';
import type { VerificationChallengeVO } from '@/api/iam/contracts';
import { ErrorNotice, FieldsForm, type Values } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { FieldValidationError, isValidEmail } from '@/components/iam/form-validation';
import { VERIFICATION_RESEND_SECONDS } from '@/components/iam/verification-policy';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { type Field } from '../../../components/iam/shared-utils';

const channels = [{ value: 'EMAIL', label: '邮箱' }, { value: 'SMS', label: '手机号' }];
export default function AuthRegister() {
  const navigate = useNavigate();
  const [channel, setChannel] = useState('EMAIL');
  const [challenge, setChallenge] = useState<VerificationChallengeVO | null>(null);
  const [now, setNow] = useState(Date.now());
  const [resendAt, setResendAt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendErrors, setSendErrors] = useState<Values>({});
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const contactVersion = useRef(0);
  useEffect(() => {
    if (!challenge && !resendAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge, resendAt]);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = !!challenge && (!challenge.expiresAt || now >= challenge.expiresAt);
  const fields: Field[] = [
    { name: 'username', label: '用户名', required: true, maxLength: 64, autoComplete: 'username' },
    { name: 'password', label: '密码', type: 'password', required: true, minLength: 8, maxLength: 128, hint: '8–128 个字符', autoComplete: 'new-password' },
    {
      name: 'confirmation',
      label: '确认密码',
      type: 'password',
      required: true,
      autoComplete: 'new-password',
      validate: (value, values) => value && value !== values.password ? '两次输入的密码不一致。' : undefined,
    },
    { name: 'channel', label: '注册方式', options: channels },
    {
      name: 'target',
      label: channel === 'EMAIL' ? '邮箱' : '手机号',
      type: channel === 'EMAIL' ? 'email' : undefined,
      required: true,
      maxLength: channel === 'EMAIL' ? 128 : 32,
      autoComplete: channel === 'EMAIL' ? 'email' : 'tel',
      validate: (value, values) => values.channel === 'SMS' && value && !/^\+?[0-9]{6,20}$/.test(value)
        ? '请输入有效的手机号。'
        : undefined,
    },
    {
      name: 'code',
      label: '验证码',
      required: !!challenge && !expired,
      minLength: 6,
      maxLength: 6,
      autoComplete: 'one-time-code',
      validate: (value) => value && !/^\d{6}$/.test(value) ? '请输入六位数字验证码。' : undefined,
    },
  ];
  async function send(values: Values) {
    if (lock.current || Date.now() < resendAt) return;
    const destination = { channel: values.channel, target: values.target.trim() };
    const version = contactVersion.current;
    lock.current = true;
    setSending(true);
    setError(null);
    setSendErrors({});
    try {
      if (destination.channel === 'EMAIL' && !isValidEmail(destination.target)) throw new FieldValidationError('target', '请输入有效的邮箱地址。');
      if (destination.channel === 'SMS' && !/^\+?[0-9]{6,20}$/.test(destination.target)) throw new FieldValidationError('target', '请输入有效的手机号。');
      const result = await request<VerificationChallengeVO>('/api/v1/verification-challenges', 'POST', { ...destination, purpose: 'REGISTER' }, { anonymous: true });
      if (!result.verificationId || !result.expiresAt || result.expiresAt <= Date.now()
        || result.purpose !== 'REGISTER' || result.channel !== destination.channel || result.target !== destination.target) throw new Error('未获取到有效的注册验证码，请重新发送。');
      const received = Date.now();
      setNow(received);
      setResendAt(received + VERIFICATION_RESEND_SECONDS * 1000);
      if (version === contactVersion.current) setChallenge(result);
    } catch (failure) {
      if (failure instanceof FieldValidationError) setSendErrors({ [failure.field]: failure.message });
      else setError(failure);
    } finally {
      lock.current = false;
      setSending(false);
    }
  }
  return <div className="space-y-5">
    <FieldsForm fullWidth compactErrors fields={fields}
      clearFieldErrorsOnChange={{ target: ['code'], channel: ['target', 'code'] }}
      fieldErrors={{ ...sendErrors, ...(expired ? { code: '验证码已过期，请重新获取。' } : {}) }}
      errorToFields={(failure) => {
        if (!(failure instanceof OpenPlatformApiError)) return {};
        if (failure.code === 'VERIFICATION_INVALID') return { code: failure.message };
        return Object.fromEntries(failure.errors.map((entry) => [
          ['email', 'phone'].includes(entry.field) ? 'target' : entry.field === 'verificationId' ? 'code' : entry.field,
          entry.message,
        ]));
      }} label="注册账号" submitDisabled={sending}
      onFieldChange={(name, value) => {
        setSendErrors((previous) => ({ ...previous, [name]: '' }));
        if (name !== 'target' && name !== 'channel') return;
        contactVersion.current += 1;
        setChallenge(null);
        setError(null);
        setSendErrors({});
        if (name === 'channel') setChannel(value);
      }}
      fieldActions={{ code: (values, busy) => <Button type="button" variant="outline" className="shrink-0" disabled={remaining > 0 || sending || busy}
        onClick={() => void send(values)}>{sending ? '正在发送…' : remaining > 0 ? `${remaining} 秒后重发` : challenge ? '重新发送验证码' : '获取验证码'}</Button> }}
      onSave={async (values) => {
        if (values.password !== values.confirmation) throw new FieldValidationError('confirmation', '两次输入的密码不一致。');
        if (!challenge || challenge.channel !== values.channel || challenge.target !== values.target.trim()) throw new FieldValidationError('code', '请先获取当前联系方式的验证码。');
        if (!challenge.verificationId || !challenge.expiresAt || Date.now() >= challenge.expiresAt) throw new FieldValidationError('code', '验证码已过期，请重新获取。');
        if (!/^\d{6}$/.test(values.code)) throw new FieldValidationError('code', '请输入六位数字验证码。');
        await request('/api/v1/accounts', 'POST', {
          username: values.username.trim(), password: values.password,
          ...(values.channel === 'EMAIL' ? { email: values.target.trim() } : { phone: values.target.trim() }),
          verificationId: challenge.verificationId, code: values.code,
        }, { anonymous: true });
      }} afterSave={() => navigate('/auth/auth2/login', { replace: true })}>
      <ErrorNotice error={error} />
    </FieldsForm>
    <Link className="text-sm hover:underline" to="/auth/auth2/login">已有账号，返回登录</Link>
  </div>;
}
