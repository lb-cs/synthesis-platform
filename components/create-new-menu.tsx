'use client';

import { FilePlus, FolderPlus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** The header's top-right "Create New": a workspace always, a source while one is open. */
export function CreateNewMenu() {
  const { projectId } = useParams<{ projectId?: string }>();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Plus />
        <span className="hidden sm:inline">Create New</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<Link href="/projects/new" />}>
          <FolderPlus />
          Workspace
        </DropdownMenuItem>
        {projectId && (
          <DropdownMenuItem render={<Link href={`/projects/${projectId}/sources`} />}>
            <FilePlus />
            Source
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
