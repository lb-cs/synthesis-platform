import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export const metadata: Metadata = {
  title: 'New project · Synthesis Platform',
};

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        title="New project"
        description="A project holds the sources and conversations for one research topic."
      />

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>You can rename the project later.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Not wired up: the create action lands with CECS491-9. */}
          <form id="new-project-form">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" name="title" placeholder="e.g. Battery recycling" />
                <FieldDescription>Required. Up to 100 characters.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="What are you trying to find out?"
                />
                <FieldDescription>Optional.</FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            variant="ghost"
            render={<Link href="/dashboard" />}
            nativeButton={false}
          >
            Cancel
          </Button>
          <Button type="submit" form="new-project-form" disabled>
            Create project
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
