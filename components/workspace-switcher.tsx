'use client';

import { ChevronsUpDown, FolderOpen, Plus, Search } from 'lucide-react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

/** What the switcher needs of a project: enough to list it and open it. */
export type WorkspaceOption = {
  id: string;
  title: string;
};

/**
 * The header's workspace picker, styled after Vercel's project switcher: shows the open
 * workspace (or "All workspaces"), and opens a search row, the list of workspaces with a
 * check on the open one, and "Create workspace" at the foot.
 */
export function WorkspaceSwitcher({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const router = useRouter();
  const { projectId } = useParams<{ projectId?: string }>();
  const [open, setOpen] = useState(false);

  const current = workspaces.find((workspace) => workspace.id === projectId) ?? null;
  const triggerLabel = current?.title ?? 'All workspaces';

  function openWorkspace(workspace: WorkspaceOption | null) {
    if (!workspace) {
      return;
    }

    router.push(`/projects/${workspace.id}`);
  }

  function closeMenu() {
    setOpen(false);
  }

  return (
    <Combobox
      items={workspaces}
      value={current}
      onValueChange={openWorkspace}
      open={open}
      onOpenChange={setOpen}
      itemToStringLabel={(workspace) => workspace.title}
      isItemEqualToValue={(item, value) => item.id === value.id}
    >
      {/* The primitive trigger, not the shadcn one: that one adds its own down chevron. */}
      <ComboboxPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="max-w-48 gap-1.5 px-2 font-medium sm:max-w-72"
          />
        }
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronsUpDown className="text-muted-foreground" />
      </ComboboxPrimitive.Trigger>

      <ComboboxContent align="start" sideOffset={8} className="w-80 rounded-xl">
        {/* A bare input, not ComboboxInput: Vercel's search row is borderless, full width. */}
        <div className="flex h-12 items-center gap-3 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <ComboboxPrimitive.Input
            placeholder="Find workspace…"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="pointer-events-none rounded-md border px-1.5 py-0.5 font-sans text-xs text-muted-foreground">
            Esc
          </kbd>
        </div>

        <ComboboxEmpty className="py-6">No workspaces found.</ComboboxEmpty>
        <ComboboxList className="p-2 data-empty:p-0">
          {(workspace: WorkspaceOption) => (
            <ComboboxItem
              key={workspace.id}
              value={workspace}
              className="gap-3 rounded-lg py-2 pr-9 pl-2.5"
            >
              <FolderOpen className="text-muted-foreground" />
              <span className="truncate">{workspace.title}</span>
            </ComboboxItem>
          )}
        </ComboboxList>

        <div className="border-t p-2">
          <Link
            href="/projects/new"
            onClick={closeMenu}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
          >
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            Create workspace
          </Link>
        </div>
      </ComboboxContent>
    </Combobox>
  );
}
