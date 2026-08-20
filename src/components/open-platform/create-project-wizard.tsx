import { Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import type { CreateProjectResult, ProjectKeyPairView } from '@/types/apps/open-platform';

type WizardStep = 1 | 2 | 3;

const STEP_LABELS = ['Project info', 'Confirm', 'API credentials'] as const;

function maskSecret(value: string): string {
  if (!value) return '••••••••';
  return '•'.repeat(Math.min(Math.max(value.length, 8), 32));
}

function SecretField({
  label,
  value,
  revealed,
  onToggleReveal,
}: {
  label: string;
  value: string;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={onToggleReveal}
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            title={revealed ? `Hide ${label}` : `Show ${label}`}
          >
            {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
          <CopyIdButton value={value} label={label} />
        </div>
      </div>
      <p className="font-mono text-sm break-all select-all">
        {revealed ? value : maskSecret(value)}
      </p>
    </div>
  );
}

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0" aria-label="Wizard steps">
      {STEP_LABELS.map((label, index) => {
        const n = (index + 1) as WizardStep;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center sm:flex-1">
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
              <span className={cn(active && 'font-medium')}>{label}</span>
            </div>
            {index < STEP_LABELS.length - 1 ? (
              <div
                className="mx-2 hidden h-px flex-1 bg-border sm:block"
                aria-hidden
              />
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
  const [result, setResult] = useState<CreateProjectResult | null>(null);
  const [revealClientId, setRevealClientId] = useState(false);
  const [revealSecret, setRevealSecret] = useState(false);
  const [showRevealAudit, setShowRevealAudit] = useState(false);

  const trimmedName = projectName.trim();
  const trimmedDescription = description.trim();
  const nameInvalid = nameTouched && !trimmedName;

  const keyPair: ProjectKeyPairView | null = result?.keyPair ?? null;
  const createdProjectId = result?.project.projectId;

  const overviewPath = useMemo(
    () => (createdProjectId ? `/projects/${createdProjectId}/overview` : null),
    [createdProjectId],
  );

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
      // Keep keyPair in React state only — never URL or localStorage.
      setResult(created);
      setStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error('Failed to create project'));
      // Stay on step 2 with inputs preserved.
    } finally {
      setSubmitting(false);
    }
  }, [createProject, submitting, trimmedDescription, trimmedName]);

  const handleRevealSecret = () => {
    setRevealSecret((prev) => {
      const next = !prev;
      if (next) setShowRevealAudit(true);
      return next;
    });
  };

  const handleGoOverview = () => {
    if (!overviewPath) return;
    navigate(overviewPath);
  };

  const apiErr =
    submitError instanceof OpenPlatformApiError ? submitError : null;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Create Project</CardTitle>
        <CardDescription>
          Set a name and optional description, confirm, then save your API
          credentials for this Project.
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
                Project name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="create-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder="e.g. Smart Home Hub"
                aria-invalid={nameInvalid || undefined}
                autoComplete="off"
                maxLength={128}
              />
              {nameInvalid ? (
                <FieldError>Project name is required.</FieldError>
              ) : (
                <FieldDescription>Shown in the Project list and switcher.</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="create-project-description">Description</FieldLabel>
              <Textarea
                id="create-project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional short description"
                maxLength={512}
                rows={4}
              />
              <FieldDescription>Optional. You can edit this later.</FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Project name</p>
                <p className="font-medium break-words">{trimmedName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Description</p>
                <p className="break-words whitespace-pre-wrap">
                  {trimmedDescription || (
                    <span className="text-muted-foreground italic">None</span>
                  )}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                Creating this Project makes you the OWNER and provisions one API
                key pair (Client ID / Client Secret).
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

        {step === 3 && keyPair && result ? (
          <div className="space-y-4">
            <Alert>
              <KeyRound aria-hidden />
              <AlertTitle>Project created</AlertTitle>
              <AlertDescription>
                <p>
                  <span className="font-medium text-foreground">
                    {result.project.projectName}
                  </span>{' '}
                  is ready. Store Client ID and Client Secret in a secure place
                  before continuing.
                </p>
                <p className="mt-1 font-mono text-xs break-all">
                  Project ID: {result.project.projectId}
                </p>
              </AlertDescription>
            </Alert>

            {showRevealAudit ? (
              <Alert>
                <Eye aria-hidden />
                <AlertTitle>Secret revealed</AlertTitle>
                <AlertDescription>
                  Showing Client Secret in the browser is auditable. Hide it when
                  you are done copying.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <SecretField
                label="Client ID"
                value={keyPair.clientId}
                revealed={revealClientId}
                onToggleReveal={() => setRevealClientId((v) => !v)}
              />
              <SecretField
                label="Client Secret"
                value={keyPair.clientSecret}
                revealed={revealSecret}
                onToggleReveal={handleRevealSecret}
              />
            </div>
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
              Cancel
            </Button>
            <Button type="button" onClick={goConfirm} disabled={!trimmedName}>
              Continue
            </Button>
          </>
        ) : null}

        {step === 2 ? (
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
              Back
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
                  Creating…
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </>
        ) : null}

        {step === 3 && overviewPath ? (
          <>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link to="/projects" />}
            >
              Back to list
            </Button>
            <Button type="button" onClick={handleGoOverview}>
              Go to Project overview
            </Button>
          </>
        ) : null}
      </CardFooter>
    </Card>
  );
}
