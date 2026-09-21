// Plain constants (no 'server-only') so both the client-side form and the
// server-only mock-store can import them without pulling server code into the browser bundle.
export const TITLE_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;

export interface Project {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  createdAt: string; // ISO timestamp
}

export interface CreateProjectInput {
  title: string;
  description?: string;
}
