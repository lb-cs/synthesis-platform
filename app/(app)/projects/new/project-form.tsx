'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
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
import { Textarea } from '@/components/ui/textarea';

import { createProject } from '../actions';
import { createProjectSchema, type CreateProjectInput } from '../schema';
import { TITLE_MAX_LENGTH } from '@/lib/projects/types';

export function ProjectForm() {
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { title: '', description: '' },
  });

  async function onSubmit(values: CreateProjectInput) {
    // On success this redirects to /projects/[id] and never returns here —
    // see app/(app)/projects/actions.ts. We only ever see a result on failure.
    const result = await createProject(values);
    if (result?.error) {
      form.setError('root', { message: result.error });
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Project details</CardTitle>
        <CardDescription>You can rename the project later.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="new-project-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="e.g. Battery recycling"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Required. Up to {TITLE_MAX_LENGTH} characters.
                    </p>
                  )}
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <Textarea
                    {...field}
                    id={field.name}
                    placeholder="What are you trying to find out?"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Optional.</p>
                  )}
                </Field>
              )}
            />
            {form.formState.errors.root && (
              <FieldError errors={[form.formState.errors.root]} />
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" render={<Link href="/dashboard" />} nativeButton={false}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="new-project-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Creating…' : 'Create project'}
        </Button>
      </CardFooter>
    </Card>
  );
}
