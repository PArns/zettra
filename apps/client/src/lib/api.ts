import type { AuthTokenDto, BlockDto } from '@zettra/shared';

/** Typed API client. Same-origin `/api` (dev proxy / prod nginx). JWT in localStorage (§2). */
const TOKEN_KEY = 'zettra.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Tag {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  defaultViewId: string | null;
}
export interface Space {
  id: string;
  name: string;
  aiPolicy: string;
}
export interface UserSettings {
  themeMode?: 'light' | 'dark' | 'system';
  accent?: string;
  language?: 'de' | 'en';
}
export interface View {
  id: string;
  name: string;
  tagId: string | null;
  layout: string;
  groupBy: string | null;
}
export interface EffectiveField {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}
export interface ViewData {
  view: View;
  fields: EffectiveField[];
  rows: { block: BlockDto; values: Record<string, unknown> }[];
}
export interface RelatedResult {
  blockId: string;
  distance: number;
  preview: string;
}
export interface BacklinkResult {
  block: BlockDto;
  kind: string;
  status: string;
  confidence: number | null;
}
export interface ReviewEdge {
  id: string;
  source: { id: string; title: string };
  target: { id: string; title: string };
  confidence: number | null;
}
export interface EntityHit {
  blockId: string;
  alias: string;
}
export interface Notification {
  id: string;
  kind: 'mention' | 'task_assignment' | 'review_request';
  sourceBlockId: string | null;
  actorName: string | null;
  read: boolean;
  createdAt: string;
}

export const api = {
  register: (i: { tenantName: string; email: string; password: string }) =>
    request<AuthTokenDto>('/auth/register', { method: 'POST', body: JSON.stringify(i) }),
  login: (i: { tenantId: string; email: string; password: string }) =>
    request<AuthTokenDto>('/auth/login', { method: 'POST', body: JSON.stringify(i) }),
  me: () =>
    request<{
      userId: string;
      tenantId: string;
      spaces: string[];
      email: string | null;
      displayName: string | null;
    }>('/auth/me'),
  getSettings: () => request<UserSettings>('/auth/me/settings'),
  saveSettings: (patch: UserSettings) =>
    request<UserSettings>('/auth/me/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  updateProfile: (patch: { displayName?: string; email?: string }) =>
    request<{ email: string; displayName: string | null }>('/auth/me/profile', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/auth/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  spaces: () => request<Space[]>('/spaces'),
  tags: () => request<Tag[]>('/tags'),
  views: () => request<View[]>('/views'),
  viewData: (id: string) => request<ViewData>(`/views/${id}/data`),

  inbox: () => request<BlockDto[]>('/views/inbox'),
  forReview: () => request<BlockDto[]>('/views/for-review'),
  markReviewed: (id: string) => request<BlockDto>(`/blocks/${id}/reviewed`, { method: 'POST' }),
  block: (id: string) => request<BlockDto>(`/blocks/${id}`),
  createBlock: (i: {
    spaceId: string;
    content?: unknown;
    source?: 'manual' | 'upload' | 'web_clip' | 'voice' | 'email';
    sourceRef?: string;
  }) => request<BlockDto>('/blocks', { method: 'POST', body: JSON.stringify(i) }),

  related: (id: string) => request<RelatedResult[]>(`/blocks/${id}/related`),
  backlinks: (id: string) => request<BacklinkResult[]>(`/blocks/${id}/backlinks`),
  fieldValues: (id: string) =>
    request<
      {
        fieldId: string;
        valueText: string | null;
        valueNumber: string | null;
        valueDate: string | null;
        valueBool: boolean | null;
        valueJson: unknown;
      }[]
    >(`/blocks/${id}/fields`),
  setField: (blockId: string, fieldId: string, value: unknown) =>
    request(`/blocks/${blockId}/fields`, {
      method: 'PUT',
      body: JSON.stringify({ fieldId, value }),
    }),
  tagFields: (tagId: string) => request<EffectiveField[]>(`/tags/${tagId}/fields`),
  setVisibility: (blockId: string, visibility: 'space' | 'private') =>
    request<BlockDto>(`/blocks/${blockId}/visibility`, {
      method: 'PUT',
      body: JSON.stringify({ visibility }),
    }),

  review: () => request<ReviewEdge[]>('/review'),
  confirmReview: (id: string) => request(`/review/${id}/confirm`, { method: 'POST' }),
  dismissReview: (id: string) => request(`/review/${id}/dismiss`, { method: 'POST' }),

  searchEntities: (q: string) =>
    request<EntityHit[]>(`/entities/search?q=${encodeURIComponent(q)}`),
  search: (q: string) =>
    request<{ blockId: string; score: number; preview: string }[]>(
      `/search?q=${encodeURIComponent(q)}`,
    ),
  createEntity: (i: { name: string; tagName?: string }) =>
    request<{ blockId: string; label: string }>('/entities', {
      method: 'POST',
      body: JSON.stringify(i),
    }),

  applyTag: (tagId: string, blockId: string) =>
    request(`/tags/${tagId}/apply/${blockId}`, { method: 'POST' }),
  setTagParent: (tagId: string, parentId: string | null) =>
    request<Tag>(`/tags/${tagId}/parent`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId }),
    }),

  notifications: () => request<Notification[]>('/notifications'),
  markNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  capture: (i: { text: string; title?: string; url?: string }) =>
    request<BlockDto>('/capture', { method: 'POST', body: JSON.stringify(i) }),

  /** Upload a file (image) → returns its served URL. Backs BlockNote's uploadFile. */
  async upload(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { authorization: `Bearer ${getToken() ?? ''}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return (await res.json()).url as string;
  },
};
