import type { Json } from '@/lib/supabase/database.types';

// Fixed to UTC so the server render and the browser agree on the day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export type MetadataEntry = { label: string; value: string };

export function formatAddedDate(createdAt: string): string {
  return DATE_FORMAT.format(new Date(createdAt));
}

function formatMetadataLabel(key: string): string {
  const separated = key.replace(/([a-z])([A-Z])/g, '$1 $2');
  const spaced = separated.replace(/[_-]+/g, ' ').toLowerCase();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatMetadataValue(value: Json | undefined): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

// The worker writes a flat object (author, page count); anything else shows no details.
export function getMetadataEntries(metadata: Json): MetadataEntry[] {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return [];
  }

  return Object.entries(metadata).map(([key, value]) => {
    return { label: formatMetadataLabel(key), value: formatMetadataValue(value) };
  });
}
