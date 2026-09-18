'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

import { sendCode, verifyCode } from './actions';
import { codeSchema, emailSchema, type CodeInput, type EmailInput } from './schema';

export function LoginForm() {
  const [email, setEmail] = useState<string | null>(null);

  if (email === null) {
    return <EmailStep onSent={setEmail} />;
  }

  return (
    <CodeStep
      email={email}
      onBack={() => {
        setEmail(null);
      }}
    />
  );
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const form = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: EmailInput) {
    const { error } = await sendCode(values);
    if (error) {
      form.setError('root', { message: error });
      return;
    }
    onSent(values.email);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>We&apos;ll email you a one-time code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="email-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    autoComplete="email"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {form.formState.errors.root && (
              <FieldError errors={[form.formState.errors.root]} />
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Button
          type="submit"
          form="email-form"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          Send code
        </Button>
      </CardFooter>
    </Card>
  );
}

function CodeStep({ email, onBack }: { email: string; onBack: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<CodeInput>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email, token: '' },
  });

  // Redirects to /dashboard on success, so we only ever see an error back.
  async function onSubmit(values: CodeInput) {
    const { error } = await verifyCode(values);
    form.setError('root', { message: error });
  }

  async function resend() {
    setNotice(null);
    const { error } = await sendCode({ email });
    setNotice(error ?? 'We sent you a new code.');
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>Enter the 6-digit code we sent to {email}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="code-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="token"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Code</FieldLabel>
                  <InputOTP
                    {...field}
                    id={field.name}
                    maxLength={6}
                    autoComplete="one-time-code"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }, (_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {form.formState.errors.root && (
              <FieldError errors={[form.formState.errors.root]} />
            )}
            {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button
          type="submit"
          form="code-form"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          Verify
        </Button>
        <div className="flex w-full justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            Use a different email
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resend}>
            Resend code
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
