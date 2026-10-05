import { AuthShell } from '@/components/iam/auth-shell';
import AuthRegister from '../../authforms/auth-register';
export default function Page() {
  return (
    <AuthShell title="注册账号">
      <AuthRegister />
    </AuthShell>
  );
}
