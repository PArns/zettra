import type {
  AuthTokenDto,
  BlockDto,
  FolderDto,
  LoginResultDto,
  TodoItemDto,
} from '@zettra/shared';

export type TodoItem = TodoItemDto;

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
      // Only declare a JSON body when one is actually sent — Fastify's parser rejects a request
      // that advertises `application/json` but has an empty body (bodyless DELETE/POST → 400).
      ...(init.body != null ? { 'content-type': 'application/json' } : {}),
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
  extendsId: string | null;
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
  language?: 'en' | 'de' | 'es' | 'fr';
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
  /** The supertag that actually defines this field — differs from the viewed tag if inherited. */
  tagId: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  position: number;
}
/** A lightweight entity option for a relation-field picker. */
export interface EntityOption {
  blockId: string;
  title: string;
}
/** A workspace member's public identity, for a user-field picker. */
export interface Member {
  id: string;
  displayName: string | null;
  email: string;
}
/** A tenant user as seen in the admin console. */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
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
export interface RelationBacklink {
  block: BlockDto;
  fieldId: string;
  fieldName: string;
}
/** A reminder / Wiedervorlage as returned by the API. */
export interface ReminderView {
  id: string;
  blockId: string;
  title: string;
  remindAt: string;
  note: string | null;
  status: string;
  recurrence: string | null;
}
/** One dated thing on the calendar agenda (§3). */
export interface AgendaItem {
  blockId: string;
  title: string;
  /** `YYYY-MM-DD`. */
  date: string;
  kind: 'reminder' | 'field';
  label?: string;
}
export interface AgendaDay {
  iso: string;
  items: AgendaItem[];
}
export interface Agenda {
  days: AgendaDay[];
  /** ISO days carrying more than one item — candidate scheduling conflicts. */
  conflicts: string[];
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
  login: (i: { email: string; password: string }) =>
    request<LoginResultDto>('/auth/login', { method: 'POST', body: JSON.stringify(i) }),
  me: () =>
    request<{
      userId: string;
      tenantId: string;
      spaces: string[];
      email: string | null;
      displayName: string | null;
      role: string;
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

  tenantLimits: () =>
    request<{
      tier: 'free' | 'pro' | 'team';
      limits: {
        members: number | null;
        spaces: number | null;
        blocks: number | null;
        storageMb: number | null;
      };
      usage: { members: number; spaces: number; blocks: number; storageMb: number };
    }>('/tenant/limits'),

  spaces: () => request<Space[]>('/spaces'),
  tags: () => request<Tag[]>('/tags'),
  views: () => request<View[]>('/views'),
  viewData: (id: string) => request<ViewData>(`/views/${id}/data`),
  updateView: (id: string, patch: { layout?: string; groupBy?: string | null }) =>
    request<View>(`/views/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  inbox: () => request<BlockDto[]>('/views/inbox'),
  todayItems: () => request<BlockDto[]>('/views/today-items'),
  todos: () => request<TodoItem[]>('/views/todos'),
  setTodoStatus: (blockId: string, status: string) =>
    request<{ ok: true }>(`/views/todos/${blockId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  forReview: () => request<BlockDto[]>('/views/for-review'),
  markReviewed: (id: string) => request<BlockDto>(`/blocks/${id}/reviewed`, { method: 'POST' }),
  block: (id: string) => request<BlockDto>(`/blocks/${id}`),
  createBlock: (i: {
    spaceId: string;
    content?: unknown;
    source?: 'manual' | 'upload' | 'web_clip' | 'voice' | 'email';
    sourceRef?: string;
  }) => request<BlockDto>('/blocks', { method: 'POST', body: JSON.stringify(i) }),

  deleteBlock: (id: string) => request<{ ok: true }>(`/blocks/${id}`, { method: 'DELETE' }),
  /** Set a note's Notion-style header (emoji icon + cover image); either field may be null to clear. */
  setNoteHeader: (id: string, patch: { icon?: string | null; coverImageUrl?: string | null }) =>
    request<BlockDto>(`/blocks/${id}/header`, { method: 'PUT', body: JSON.stringify(patch) }),

  related: (id: string) => request<RelatedResult[]>(`/blocks/${id}/related`),
  backlinks: (id: string) => request<BacklinkResult[]>(`/blocks/${id}/backlinks`),

  // Note folders — the sidebar organization tree (§8.2).
  folders: () => request<FolderDto[]>('/folders'),
  createFolder: (i: { name: string; spaceId: string; parentId?: string | null }) =>
    request<FolderDto>('/folders', { method: 'POST', body: JSON.stringify(i) }),
  renameFolder: (id: string, name: string) =>
    request<FolderDto>(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  setFolderParent: (id: string, parentId: string | null) =>
    request<FolderDto>(`/folders/${id}/parent`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId }),
    }),
  deleteFolder: (id: string) => request<{ ok: true }>(`/folders/${id}`, { method: 'DELETE' }),
  /** File a note into a folder (or back to the Briefkasten with `folderId: null`). */
  fileNote: (blockId: string, folderId: string | null) =>
    request<{ ok: true }>(`/folders/file/${blockId}`, {
      method: 'POST',
      body: JSON.stringify({ folderId }),
    }),
  folderNotes: (id: string) => request<BlockDto[]>(`/folders/${id}/notes`),

  // Proactive daily briefing (§4): AI summary of today's to-dos, reminders, and fresh notes.
  dailyBriefing: () =>
    request<{
      briefing: string;
      dueTodos: TodoItem[];
      reminderCount: number;
      updatedCount: number;
    }>('/ai/briefing'),

  // AI chat over the index (§1).
  aiChat: (question: string, spaceId?: string) =>
    request<{ answer: string; sources: { blockId: string; title: string }[] }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ question, spaceId }),
    }),

  // Calendar agenda over reminders + date fields (§3).
  calendarAgenda: (from: string, to: string) =>
    request<Agenda>(`/calendar/agenda?from=${from}&to=${to}`),

  // Reminders / Wiedervorlage (§3–§4).
  blockReminders: (blockId: string) => request<ReminderView[]>(`/reminders/block/${blockId}`),
  remindersUpcoming: () => request<ReminderView[]>('/reminders/upcoming'),
  createReminder: (i: { blockId: string; remindAt: string; note?: string; recurrence?: string }) =>
    request<ReminderView>('/reminders', { method: 'POST', body: JSON.stringify(i) }),
  reminderDone: (id: string) => request(`/reminders/${id}/done`, { method: 'POST' }),
  reminderDismiss: (id: string) => request(`/reminders/${id}/dismiss`, { method: 'POST' }),
  deleteReminder: (id: string) => request(`/reminders/${id}`, { method: 'DELETE' }),
  relationBacklinks: (id: string) =>
    request<RelationBacklink[]>(`/blocks/${id}/relation-backlinks`),
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
  /** Entities carrying a supertag — the option list for a relation field. */
  tagEntities: (tagId: string) => request<EntityOption[]>(`/views/tag/${tagId}/entities`),
  /** Workspace members visible to the caller — the option list for a user field. */
  members: () => request<Member[]>('/members'),

  // Admin console (§2) — admin-only endpoints.
  adminUsers: () => request<AdminUser[]>('/admin/users'),
  adminCreateUser: (i: { email: string; password: string; displayName?: string; role?: string }) =>
    request<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(i) }),
  adminSetUserRole: (userId: string, role: string) =>
    request(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  adminDeleteUser: (userId: string) => request(`/admin/users/${userId}`, { method: 'DELETE' }),
  adminImpersonate: (userId: string) =>
    request<{ accessToken: string }>(`/admin/users/${userId}/impersonate`, { method: 'POST' }),
  adminSpaces: () => request<Space[]>('/admin/spaces'),
  adminCreateSpace: (name: string) =>
    request<Space>('/admin/spaces', { method: 'POST', body: JSON.stringify({ name }) }),
  adminDeleteSpace: (spaceId: string) => request(`/admin/spaces/${spaceId}`, { method: 'DELETE' }),
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
  removeTag: (tagId: string, blockId: string) =>
    request<{ ok: true }>(`/tags/${tagId}/apply/${blockId}`, { method: 'DELETE' }),
  setTagParent: (tagId: string, parentId: string | null) =>
    request<Tag>(`/tags/${tagId}/parent`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId }),
    }),

  // Supertag definition CRUD (§8.1).
  createTag: (i: {
    name: string;
    icon?: string;
    color?: string;
    parentId?: string | null;
    extendsId?: string | null;
    fields?: { name: string; type: string; config?: Record<string, unknown>; position?: number }[];
  }) => request<Tag>('/tags', { method: 'POST', body: JSON.stringify(i) }),
  updateTag: (
    tagId: string,
    patch: {
      name?: string;
      icon?: string | null;
      color?: string | null;
      extendsId?: string | null;
    },
  ) => request<Tag>(`/tags/${tagId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  addField: (
    tagId: string,
    field: { name: string; type: string; config?: Record<string, unknown>; position?: number },
  ) => request(`/tags/${tagId}/fields`, { method: 'POST', body: JSON.stringify(field) }),
  updateField: (
    fieldId: string,
    patch: {
      name?: string;
      type?: string;
      config?: Record<string, unknown>;
      position?: number;
    },
  ) => request(`/tags/fields/${fieldId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeField: (fieldId: string) => request(`/tags/fields/${fieldId}`, { method: 'DELETE' }),

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
