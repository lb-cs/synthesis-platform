'use client';

import { ChevronsUpDown, FolderOpen, LayoutGrid, Plus } from 'lucide-react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
} from '@/components/ui/combobox';

/** What the switcher needs of a project: enough to list it and open it. */
export type WorkspaceOption = {
  id: string;
  title: string;
};

const FOOTER_LINK_CLASS =
  'flex items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0';

/**
 * The header's workspace picker: shows the open workspace (or "All workspaces"), and
 * opens a searchable list of the user's workspaces with links to see them all or make one.
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

      <ComboboxContent align="start" className="w-72">
        <ComboboxInput placeholder="Find workspace…" showTrigger={false} />
        <ComboboxEmpty>No workspaces found.</ComboboxEmpty>
        <ComboboxList>
          {(workspace: WorkspaceOption) => (
            <ComboboxItem key={workspace.id} value={workspace}>
              <FolderOpen className="text-muted-foreground" />
              <span className="truncate">{workspace.title}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxSeparator className="mx-0" />
        <div className="flex flex-col p-1">
          <Link href="/workspaces" className={FOOTER_LINK_CLASS} onClick={closeMenu}>
            <LayoutGrid />
            All workspaces
          </Link>
          <Link href="/projects/new" className={FOOTER_LINK_CLASS} onClick={closeMenu}>
            <Plus />
            Create workspace
          </Link>
        </div>
      </ComboboxContent>
    </Combobox>
  );
}
