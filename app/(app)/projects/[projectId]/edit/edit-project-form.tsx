'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { useTransition } from 'react';

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
import type { Project } from '@/lib/projects';

import { deleteProject, updateProject } from '../../actions';
import {
  createProjectSchema,
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type CreateProjectInput,
} from '../../schema';

export function EditProjectForm({
  projectId,
  project,
}: {
  projectId: string;
  project: Project;
}) {
  const [isDeleting, startTransition] = useTransition();
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: project.title,
      description: project.description ?? '',
    },
  });

  async function onSubmit(values: CreateProjectInput) {
    const result = await updateProject({ projectId, values });

    if (result?.error) {
      form.setError('root', { message: result.error });
    }
  }

  function onDelete() {
    const confirmed = window.confirm(
      `Delete "${project.title}"? Its sources and chat will be deleted too. This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteProject(projectId);

      if (result?.error) {
        form.setError('root', { message: result.error });
      }
    });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Project details</CardTitle>
        <CardDescription>Changes apply to this project only.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="edit-project-form" onSubmit={form.handleSubmit(onSubmit)}>
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
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Optional. Up to {DESCRIPTION_MAX_LENGTH} characters.
                    </p>
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
      <CardFooter className="justify-between gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting || form.formState.isSubmitting}
          onClick={onDelete}
        >
          {isDeleting ? 'Deleting…' : 'Delete project'}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            render={<Link href={`/projects/${projectId}`} />}
            nativeButton={false}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-project-form"
            disabled={isDeleting || form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
