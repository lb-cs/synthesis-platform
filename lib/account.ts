/**
 * Permanent account deletion. Needs the service-role client: Storage files do not
 * cascade, and deleting an auth user is an admin call. The database cascade then removes
 * projects, sources, chunks, chat and citations.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { removeFiles } from '@/lib/storage';
import type { Database } from '@/lib/supabase/database.types';

const SOURCES_BUCKET = 'sources';
const LIST_PAGE_SIZE = 100;
const REMOVE_BATCH_SIZE = 100;
const NOT_FOUND = 404;

export type DeleteAccountErrorKind = 'storage-error' | 'auth-error';

export type DeleteAccountResult =
  { ok: true } | { ok: false; kind: DeleteAccountErrorKind };

type AdminClient = SupabaseClient<Database>;

// Storage lists one folder level at a time. Entries with no id are subfolders.
async function listFolder(
  admin: AdminClient,
  folder: string,
): Promise<{ files: string[]; folders: string[] } | null> {
  const files: string[] = [];
  const folders: string[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await admin.storage
      .from(SOURCES_BUCKET)
      .list(folder, { limit: LIST_PAGE_SIZE, offset });

    if (error) {
      return null;
    }

    data.forEach((object) => {
      const path = `${folder}/${object.name}`;

      if (object.id) {
        files.push(path);
        return;
      }

      folders.push(path);
    });

    hasMore = data.length === LIST_PAGE_SIZE;
    offset += LIST_PAGE_SIZE;
  }

  return { files, folders };
}

// Every file under a folder, however deep. Null means a listing failed, so the caller
// must not go on to delete the user.
async function collectFilePaths(
  admin: AdminClient,
  folder: string,
): Promise<string[] | null> {
  const listing = await listFolder(admin, folder);

  if (!listing) {
    return null;
  }

  const paths = [...listing.files];

  for (const subfolder of listing.folders) {
    const nested = await collectFilePaths(admin, subfolder);

    if (!nested) {
      return null;
    }

    paths.push(...nested);
  }

  return paths;
}

async function removeUserFiles(admin: AdminClient, userId: string): Promise<boolean> {
  const paths = await collectFilePaths(admin, userId);

  if (!paths) {
    return false;
  }

  for (let start = 0; start < paths.length; start += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(start, start + REMOVE_BATCH_SIZE);
    const result = await removeFiles(admin, batch);

    if (!result.ok) {
      return false;
    }
  }

  return true;
}

/** Files first, then the user. If the files fail, the user is kept so a retry works. */
export async function deleteAccount(
  admin: AdminClient,
  userId: string,
): Promise<DeleteAccountResult> {
  const filesRemoved = await removeUserFiles(admin, userId);

  if (!filesRemoved) {
    return { ok: false, kind: 'storage-error' };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);

  // Already gone (a retry after a half-finished attempt) counts as done.
  if (error && error.status !== NOT_FOUND) {
    return { ok: false, kind: 'auth-error' };
  }

  return { ok: true };
}
