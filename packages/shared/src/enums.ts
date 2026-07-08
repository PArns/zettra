/**
 * Canonical enums shared across server, collab and client.
 *
 * These mirror the Postgres enum types declared in the initial migration. Keep the string
 * values in sync with the DB — TypeORM `enum` columns persist the string values verbatim.
 */

/** Capture provenance of a block (§6.1 `block.source`). */
export enum BlockSource {
  Manual = 'manual',
  Email = 'email',
  Upload = 'upload',
  WebClip = 'web_clip',
  Voice = 'voice',
}

/** Field types for a supertag's schema (§6.1 `tag_field.type`). */
export enum FieldType {
  Text = 'text',
  Number = 'number',
  Date = 'date',
  Checkbox = 'checkbox',
  Select = 'select',
  MultiSelect = 'multi_select',
  Relation = 'relation',
  User = 'user',
  Url = 'url',
  File = 'file',
}

/** How a hard graph edge came to exist (§6.1 `block_relation.kind`). */
export enum RelationKind {
  /** Deterministic mention linking (§8.4 layer 1) or editor `[[reference]]`. */
  Mention = 'mention',
  /** A typed relation-field link. */
  Relation = 'relation',
  /** Proposed by LLM curation (§8.4 layer 3), pending approval. */
  Suggested = 'suggested',
}

/** Lifecycle status of a hard graph edge (§6.1 `block_relation.status`). */
export enum RelationStatus {
  Confirmed = 'confirmed',
  Suggested = 'suggested',
  Dismissed = 'dismissed',
}

/** Saved-view render layout (§6.1 `view.layout`). */
export enum ViewLayout {
  Table = 'table',
  Board = 'board',
  Calendar = 'calendar',
  List = 'list',
  Gallery = 'gallery',
}

/** Space-level role (§6.1 `membership.role`, §8.8). Ordered least → most privileged. */
export enum MembershipRole {
  Viewer = 'viewer',
  Commenter = 'commenter',
  Editor = 'editor',
  Owner = 'owner',
}

/** Approval-policy scope (§6.1 `approval_policy.scope`, §8.5). */
export enum PolicyScope {
  System = 'system',
  User = 'user',
  Space = 'space',
}

/** AI task profiles routed by the AiRouter (§14.1). */
export enum AiTaskType {
  /** Supertag + field extraction during capture (§8.3). Local by default. */
  CaptureTagging = 'capture_tagging',
  /** "Is this a real typed relation?" curation (§8.4 layer 3). Local → remote. */
  RelationCuration = 'relation_curation',
  /** Summarization / briefing (later). Local by default. */
  Summarization = 'summarization',
}

/**
 * Privacy scope attached to a space or tag (§14.2 axis 1). `local_only` forbids remote
 * calls regardless of task — privacy beats quality.
 */
export enum AiPrivacyScope {
  Default = 'default',
  LocalOnly = 'local_only',
}

/** Stakes hint for capability escalation (§14.2 axis 3). */
export enum AiStakes {
  Low = 'low',
  High = 'high',
}

/** Which provider tier the AiRouter selected for a request (§14.3). */
export enum AiProviderKind {
  Local = 'local',
  Remote = 'remote',
}
