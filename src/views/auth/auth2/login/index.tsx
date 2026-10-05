import { AuthShell } from '@/components/iam/auth-shell';
import AuthLogin from '../../authforms/auth-login';
export default function Page() {
  return (
    <AuthShell title="登录">
      <AuthLogin />
    </AuthShell>
  );
}
