import { request, setSession } from '@/api/iam/client';
import type { AuthResultVO } from '@/api/iam/contracts';
import { FieldsForm } from '@/components/iam/shared';
import { Link, useLocation, useNavigate } from 'react-router';
import { type Field } from '../../../components/iam/shared-utils';
const fields: Field[] = [
  {
    name: 'identifierType',
    label: '登录方式',
    options: [
      { value: 'USERNAME', label: '用户名' },
      { value: 'EMAIL', label: '邮箱' },
      { value: 'PHONE', label: '手机号' },
    ],
  },
  { name: 'identifier', label: '账号', required: true, maxLength: 128, autoComplete: 'username' },
  {
    name: 'password',
    label: '密码',
    type: 'password',
    required: true,
    maxLength: 128,
    autoComplete: 'current-password',
  },
];
export default function AuthLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="space-y-5">
      <FieldsForm
        fullWidth
        fields={fields}
        label="登录"
        onSave={async (values) => {
          const result = await request<AuthResultVO>(
            '/api/v1/authentication-sessions',
            'POST',
            { ...values, identifier: values.identifier.trim(), clientType: 'CONSOLE' },
            { anonymous: true },
          );
          setSession(result.token);
        }}
        afterSave={() => {
          const next: unknown = location.state?.from;
          navigate(
            typeof next === 'string' &&
              next.startsWith('/') &&
              !next.startsWith('//') &&
              !next.startsWith('/auth/')
              ? next
              : '/projects',
            { replace: true },
          );
        }}
      />
      <div className="flex justify-between text-sm">
        <Link className="hover:underline" to="/auth/auth2/register">
          注册账号
        </Link>
        <Link className="hover:underline" to="/auth/auth2/forgot-password">
          忘记密码
        </Link>
      </div>
    </div>
  );
}
