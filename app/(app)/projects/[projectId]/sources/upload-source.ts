import type { Source } from '@/lib/sources';
import { buildFilePath, checkFile, removeFiles, uploadFile } from '@/lib/storage';
import type { UploadFileErrorKind } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';

export type UploadSourceResult =
  { ok: true; source: Source } | { ok: false; message: string };

const TITLE_MAX_LENGTH = 200;

const UPLOAD_ERROR_MESSAGES: Record<UploadFileErrorKind, string> = {
  'unsupported-type': 'Only PDF, .txt, and .md files can be added.',
  'too-large': 'This file is over the 50 MB limit.',
  'already-exists': 'This file is already uploaded. Try again.',
  'storage-error': 'Could not upload the file. Try again.',
};

// "notes.final.md" → "notes.final"; a name that is only an extension keeps it.
function getTitle(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;

  return baseName.slice(0, TITLE_MAX_LENGTH);
}

/** Browser only: the file goes straight to Storage, then the API inserts the row. */
export async function uploadSource(
  userId: string,
  projectId: string,
  file: File,
): Promise<UploadSourceResult> {
  const check = checkFile(file);

  if (!check.ok) {
    return { ok: false, message: UPLOAD_ERROR_MESSAGES[check.kind] };
  }

  const supabase = createClient();
  const path = buildFilePath(userId, projectId, file.name);
  const uploadResult = await uploadFile(supabase, path, file);

  if (!uploadResult.ok) {
    return { ok: false, message: UPLOAD_ERROR_MESSAGES[uploadResult.kind] };
  }

  const res = await fetch(`/api/projects/${projectId}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: check.sourceKind,
      title: getTitle(file.name),
      storagePath: path,
    }),
  });

  // No row points at the file, so remove it rather than leave it unreachable.
  if (!res.ok) {
    await removeFiles(supabase, [path]);

    return { ok: false, message: 'Could not add the source. Try again.' };
  }

  const body: { source: Source } = await res.json();

  return { ok: true, source: body.source };
}
