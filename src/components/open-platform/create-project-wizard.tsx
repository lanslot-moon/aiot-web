import { Check } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  OpenPlatformApiError,
  useOpenPlatform,
} from '@/context/open-platform-context';
import { cn } from '@/lib/utils';

type WizardStep = 1 | 2;

const STEP_LABELS = ['填写信息', '确认创建'] as const;

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <ol className="flex items-center gap-2" aria-label="创建步骤">
      {STEP_LABELS.map((label, index) => {
        const n = (index + 1) as WizardStep;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                active && 'bg-primary/10 text-foreground',
                !active && !done && 'text-muted-foreground',
                done && 'text-foreground',
              )}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  active && 'border-primary bg-primary text-primary-foreground',
                  done && 'border-primary bg-primary/15 text-primary',
                  !active && !done && 'border-border',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : n}
              </span>
              <span className={cn('hidden sm:inline', active && 'font-medium')}>
                {label}
              </span>
            </div>
            {index < STEP_LABELS.length - 1 ? (
              <div className="h-px flex-1 bg-border" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function CreateProjectWizard() {
  const navigate = useNavigate();
  const { createProject } = useOpenPlatform();

  const [step, setStep] = useState<WizardStep>(1);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  const trimmedName = projectName.trim();
  const trimmedDescription = description.trim();
  const nameInvalid = nameTouched && !trimmedName;

  const goConfirm = () => {
    setNameTouched(true);
    if (!trimmedName) return;
    setSubmitError(null);
    setStep(2);
  };

  const handleCreate = useCallback(async () => {
    if (submitting || !trimmedName) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = {
        projectName: trimmedName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      };
      const created = await createProject(body);
      toast.success('项目已创建。API 密钥可在「设置 → API 授权」中查看。');
      navigate(`/projects/${created.project.projectId}/overview`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error('创建失败'));
    } finally {
      setSubmitting(false);
    }
  }, [createProject, navigate, submitting, trimmedDescription, trimmedName]);

  const apiErr =
    submitError instanceof OpenPlatformApiError ? submitError : null;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>创建项目</CardTitle>
        <CardDescription>
          只需名称与描述。创建后进入产品管理；密钥请到项目设置中查看，创建流程不展示密钥对。
        </CardDescription>
        <div className="pt-3">
          <StepIndicator step={step} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4 py-4">
        {step === 1 ? (
          <FieldGroup>
            <Field data-invalid={nameInvalid || undefined}>
              <FieldLabel htmlFor="create-project-name">
                项目名称 <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="create-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder="例如：智能酒店"
                aria-invalid={nameInvalid || undefined}
                autoComplete="off"
                maxLength={128}
              />
              {nameInvalid ? (
                <FieldError>请填写项目名称</FieldError>
              ) : (
                <FieldDescription>将显示在项目列表与切换器中</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="create-project-description">描述</FieldLabel>
              <Textarea
                id="create-project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选"
                maxLength={512}
                rows={4}
              />
              <FieldDescription>可选，之后可在设置中修改</FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <div>
                <p className="text-muted-foreground">项目名称</p>
                <p className="break-words font-medium">{trimmedName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">描述</p>
                <p className="break-words whitespace-pre-wrap">
                  {trimmedDescription || (
                    <span className="text-muted-foreground italic">未填写</span>
                  )}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                创建后你将成为 OWNER，并自动初始化一组 API 密钥（不在本页展示，请稍后在「设置 → API
                授权」查看）。
              </p>
            </div>

            {submitError ? (
              <ApiErrorAlert
                code={apiErr?.code}
                message={submitError.message}
                onRetry={() => {
                  void handleCreate();
                }}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between gap-2">
        {step === 1 ? (
          <>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link to="/projects" />}
            >
              取消
            </Button>
            <Button type="button" onClick={goConfirm} disabled={!trimmedName}>
              下一步
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (submitting) return;
                setSubmitError(null);
                setStep(1);
              }}
              disabled={submitting}
            >
              上一步
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleCreate();
              }}
              disabled={submitting || !trimmedName}
            >
              {submitting ? (
                <>
                  <Spinner />
                  创建中…
                </>
              ) : (
                '创建项目'
              )}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
