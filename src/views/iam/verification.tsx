import { useState } from 'react';
import { Link } from 'react-router';
import { request, segment } from '@/api/iam/client';
import type { VerificationChallengeVO } from '@/api/iam/contracts';
import { AuthShell } from '@/components/iam/auth-shell';
import { FieldsForm } from '@/components/iam/shared';
export default function VerificationPage() {
  const [challenge, setChallenge] = useState<VerificationChallengeVO | null>(null);
  return (
    <AuthShell title="验证联系方式" description="通过验证码验证邮箱或手机号。">
      <div className="space-y-5">
        {!challenge ? (
          <FieldsForm
            fields={[
              {
                name: 'channel',
                label: '验证渠道',
                options: [
                  { value: 'EMAIL', label: '邮箱' },
                  { value: 'SMS', label: '短信' },
                ],
              },
              { name: 'target', label: '邮箱或手机号', required: true },
              {
                name: 'purpose',
                label: '验证用途',
                options: [
                  { value: 'REGISTER', label: '注册验证' },
                  { value: 'CHANGE_EMAIL', label: '更换邮箱' },
                  { value: 'CHANGE_PHONE', label: '更换手机号' },
                ],
              },
            ]}
            label="发送验证码"
            onSave={async (values) =>
              setChallenge(
                await request<VerificationChallengeVO>(
                  '/api/v1/verification-challenges',
                  'POST',
                  values,
                  { anonymous: true },
                ),
              )
            }
          />
        ) : (
          <FieldsForm
            fields={[{ name: 'code', label: '验证码', required: true }]}
            label="确认验证"
            onSave={async (values) => {
              await request(
                `/api/v1/verification-challenges/${segment(challenge.verificationId ?? '')}`,
                'PUT',
                { ...values, target: challenge.target },
                { anonymous: true },
              );
              setChallenge(null);
            }}
          />
        )}
        <Link className="text-sm hover:underline" to="/auth/auth2/login">
          返回登录
        </Link>
      </div>
    </AuthShell>
  );
}
