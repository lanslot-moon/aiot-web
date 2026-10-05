import { AuthShell } from '@/components/iam/auth-shell';
import AuthForgotPassword from '../../authforms/auth-forgotpassword';
export default function Page() {
  return (
    <AuthShell title="找回密码" description="通过账号绑定的邮箱或手机号验证身份。">
      <AuthForgotPassword />
    </AuthShell>
  );
}
