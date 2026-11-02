'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Link2 } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { addLinkSource } from './actions';
import { addLinkFormSchema, type AddLinkFormInput } from './schema';

/** UC-12: the "Add link" button and the sheet with its form. */
export function AddLinkSheet({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<AddLinkFormInput>({
    resolver: zodResolver(addLinkFormSchema),
    defaultValues: { url: '' },
  });

  function onOpenChange(open: boolean) {
    setIsOpen(open);

    // A reopened sheet starts empty, with no leftover error.
    if (!open) {
      form.reset();
    }
  }

  async function onSubmit(values: AddLinkFormInput) {
    // A server action rejects only when the request never reaches the server.
    try {
      const { error } = await addLinkSource({ projectId, url: values.url });

      if (error) {
        form.setError('root', { message: error });
        return;
      }
    } catch {
      form.setError('root', {
        message: 'Could not reach the server. Check your connection.',
      });
      return;
    }

    onOpenChange(false);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Link2 />
        Add link
      </Button>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add a link</SheetTitle>
            <SheetDescription>
              Add a web page for the AI to draw on. It is queued for processing like an
              uploaded file.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4">
            <FieldGroup>
              <Controller
                name="url"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Web address</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      placeholder="https://example.com/article"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      A public web page. Links to files, logins, and local addresses will
                      not work.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              {form.formState.errors.root && (
                <FieldError errors={[form.formState.errors.root]} />
              )}
              <div>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Adding…' : 'Add link'}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
