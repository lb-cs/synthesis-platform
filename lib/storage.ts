/**
 * The `sources` bucket behind one small API. Works with the server or the browser client;
 * every call runs as the signed-in user, so Storage RLS keeps it to paths under their id.
 * Upload from the browser: a 50 MiB file is far over a server action's body limit.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { SourceKind } from '@/lib/sources';
import type { Database } from '@/lib/supabase/database.types';

// Mirrors file_size_limit on the bucket.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_FILE_EXTENSIONS = '.pdf,.txt,.md';

const SOURCES_BUCKET = 'sources';
const LIST_LIMIT = 100;
const SIGNED_URL_SECONDS = 60;

// Mirrors allowed_mime_types on the bucket. Browsers often report '' for .md, so the
// type comes from the extension rather than file.type.
const FILE_TYPES: Record<string, { contentType: string; sourceKind: SourceKind }> = {
  pdf: { contentType: 'application/pdf', sourceKind: 'pdf' },
  txt: { contentType: 'text/plain', sourceKind: 'text' },
  md: { contentType: 'text/markdown', sourceKind: 'text' },
};

// buildFilePath prefixes every object name with a uuid so two uploads never collide.
const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/;

export type StoredFile = {
  path: string;
  name: string;
  size: number;
  contentType: string;
  createdAt: string;
};

export type FileCheckResult =
  | { ok: true; contentType: string; sourceKind: SourceKind }
  | { ok: false; kind: 'unsupported-type' | 'too-large' };

export type UploadFileErrorKind =
  'unsupported-type' | 'too-large' | 'already-exists' | 'storage-error';

export type UploadFileResult =
  { ok: true; path: string } | { ok: false; kind: UploadFileErrorKind };

export type ListFilesResult =
  { ok: true; files: StoredFile[] } | { ok: false; kind: 'storage-error' };

export type FileUrlResult =
  { ok: true; url: string } | { ok: false; kind: 'not-found' | 'storage-error' };

export type RemoveFilesResult = { ok: true } | { ok: false; kind: 'storage-error' };

type Client = SupabaseClient<Database>;

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex === -1) {
    return '';
  }

  return fileName.slice(dotIndex + 1).toLowerCase();
}

// Storage keys reject some characters; keep the name readable but safe.
function toSafeName(fileName: string): string {
  return fileName.replace(/[^\w.-]+/g, '_');
}

/** Run in the browser before uploading, to show a per-file error without a round trip. */
export function checkFile(file: File): FileCheckResult {
  const fileType = FILE_TYPES[getExtension(file.name)];

  if (!fileType) {
    return { ok: false, kind: 'unsupported-type' };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, kind: 'too-large' };
  }

  return { ok: true, ...fileType };
}

/** `{userId}/{folder}/{uuid}-{name}`. RLS only allows paths under the caller's own id. */
export function buildFilePath(userId: string, folder: string, fileName: string): string {
  return `${userId}/${folder}/${crypto.randomUUID()}-${toSafeName(fileName)}`;
}

export async function uploadFile(
  supabase: Client,
  path: string,
  file: File,
): Promise<UploadFileResult> {
  const check = checkFile(file);

  if (!check.ok) {
    return check;
  }

  const { error } = await supabase.storage.from(SOURCES_BUCKET).upload(path, file, {
    contentType: check.contentType,
    upsert: false,
  });

  // statusCode is the HTTP status as a string; the bucket enforces type and size too.
  if (error?.statusCode === '409') {
    return { ok: false, kind: 'already-exists' };
  }

  if (error?.statusCode === '413') {
    return { ok: false, kind: 'too-large' };
  }

  if (error?.statusCode === '415') {
    return { ok: false, kind: 'unsupported-type' };
  }

  if (error) {
    return { ok: false, kind: 'storage-error' };
  }

  return { ok: true, path };
}

/** Files directly inside a folder such as `{userId}/{projectId}`, newest first. */
export async function listFiles(
  supabase: Client,
  folder: string,
): Promise<ListFilesResult> {
  const { data, error } = await supabase.storage.from(SOURCES_BUCKET).list(folder, {
    limit: LIST_LIMIT,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) {
    return { ok: false, kind: 'storage-error' };
  }

  const files: StoredFile[] = [];

  data.forEach((object) => {
    // Subfolders come back as entries with no id or metadata.
    if (!object.id || !object.metadata || !object.created_at) {
      return;
    }

    files.push({
      path: `${folder}/${object.name}`,
      name: object.name.replace(UUID_PREFIX, ''),
      size: object.metadata.size,
      contentType: object.metadata.mimetype,
      createdAt: object.created_at,
    });
  });

  return { ok: true, files };
}

/** A short-lived link to a private file. Pass `downloadAs` to save instead of view. */
export async function getFileUrl(
  supabase: Client,
  path: string,
  options: { downloadAs?: string } = {},
): Promise<FileUrlResult> {
  const { data, error } = await supabase.storage
    .from(SOURCES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: options.downloadAs });

  // RLS hides other users' files, so theirs read as not found too.
  if (error?.statusCode === '404') {
    return { ok: false, kind: 'not-found' };
  }

  if (error) {
    return { ok: false, kind: 'storage-error' };
  }

  return { ok: true, url: data.signedUrl };
}

/** A path that is already gone, or not the caller's, is skipped without an error. */
export async function removeFiles(
  supabase: Client,
  paths: string[],
): Promise<RemoveFilesResult> {
  const { error } = await supabase.storage.from(SOURCES_BUCKET).remove(paths);

  if (error) {
    return { ok: false, kind: 'storage-error' };
  }

  return { ok: true };
}
