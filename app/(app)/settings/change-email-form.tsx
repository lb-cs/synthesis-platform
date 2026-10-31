'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

import {
  codeSchema,
  emailSchema,
  type CodeInput,
  type EmailInput,
} from '@/app/login/schema';

import { resendEmailChange, sendEmailChangeCode, verifyEmailChange } from './actions';

/** UC-05: a new email takes effect once the code sent to it is entered here. */
export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (newEmail === null) {
    // Keyed so the field resets to the new address once the page re-renders with it.
    return (
      <NewEmailStep
        key={currentEmail}
        currentEmail={currentEmail}
        notice={notice}
        onSent={(email) => {
          setNotice(null);
          setNewEmail(email);
        }}
      />
    );
  }

  return (
    <ConfirmStep
      email={newEmail}
      onCancel={() => {
        setNewEmail(null);
      }}
      onConfirmed={() => {
        setNotice(`Your email is now ${newEmail}. Use it the next time you sign in.`);
        setNewEmail(null);
      }}
    />
  );
}

function NewEmailStep({
  currentEmail,
  notice,
  onSent,
}: {
  currentEmail: string;
  notice: string | null;
  onSent: (email: string) => void;
}) {
  const form = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: currentEmail },
  });

  async function onSubmit(values: EmailInput) {
    const { error } = await sendEmailChangeCode(values);

    if (error) {
      form.setError('root', { message: error });
      return;
    }

    onSent(values.email);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
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
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                We&apos;ll email a code to the new address. Your email changes once you
                enter it.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {form.formState.errors.root && (
          <FieldError errors={[form.formState.errors.root]} />
        )}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <div>
          <Button
            type="submit"
            disabled={!form.formState.isDirty || form.formState.isSubmitting}
          >
            Save changes
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

function ConfirmStep({
  email,
  onCancel,
  onConfirmed,
}: {
  email: string;
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const form = useForm<CodeInput>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email, token: '' },
  });

  async function onSubmit(values: CodeInput) {
    const { error } = await verifyEmailChange(values);

    if (error) {
      form.setError('root', { message: error });
      return;
    }

    onConfirmed();
  }

  async function resend() {
    setNotice(null);
    setResending(true);

    // A server action rejects only when the request never reaches the server.
    try {
      const { error } = await resendEmailChange({ email });
      setNotice(error ?? 'We sent you a new code.');
    } catch {
      setNotice('Could not reach the server. Check your connection and try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          name="token"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Code</FieldLabel>
              <FieldDescription>
                Enter the 6-digit code we sent to {email}.
              </FieldDescription>
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
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Confirm email
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="ghost" onClick={resend} disabled={resending}>
            Resend code
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
