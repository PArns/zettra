/**
 * Seed supertag definitions applied on tenant creation (§8.2).
 *
 * Each becomes a `tag` row plus its `tag_field` schema and a default `table` view. Field
 * `relation` targets are resolved by tag name after all tags are inserted (see the seeder
 * in apps/server). Keep this list and the field schemas conservative — schema evolution
 * for tagged blocks is a scheduled gap (§11).
 */
import { FieldType } from './enums';

export interface SeedFieldConfig {
  /** For select/multi_select. */
  options?: string[];
  /** For relation: the *name* of the target supertag; resolved to id at seed time. */
  targetTagName?: string;
}

export interface SeedField {
  name: string;
  type: FieldType;
  config?: SeedFieldConfig;
}

export interface SeedTag {
  name: string;
  icon?: string;
  color?: string;
  /** Name of the supertag this one extends (field inheritance, §8.1). */
  extends?: string;
  fields: SeedField[];
}

export const SEED_TAGS: SeedTag[] = [
  {
    name: 'person',
    icon: '👤',
    color: '#4f46e5',
    fields: [
      { name: 'email', type: FieldType.Url },
      { name: 'company', type: FieldType.Text },
      { name: 'phone', type: FieldType.Text },
    ],
  },
  {
    name: 'email',
    icon: '✉️',
    color: '#0891b2',
    fields: [
      { name: 'subject', type: FieldType.Text },
      { name: 'from', type: FieldType.Relation, config: { targetTagName: 'person' } },
      { name: 'received', type: FieldType.Date },
      {
        name: 'status',
        type: FieldType.Select,
        config: { options: ['unread', 'read', 'archived'] },
      },
    ],
  },
  {
    name: 'document',
    icon: '📄',
    color: '#65a30d',
    fields: [
      { name: 'title', type: FieldType.Text },
      { name: 'author', type: FieldType.Text },
      { name: 'url', type: FieldType.Url },
    ],
  },
  {
    name: 'webpage',
    icon: '🔖',
    color: '#c026d3',
    fields: [
      { name: 'title', type: FieldType.Text },
      { name: 'url', type: FieldType.Url },
      { name: 'clipped', type: FieldType.Date },
    ],
  },
  {
    name: 'task',
    icon: '✅',
    color: '#ea580c',
    fields: [
      {
        name: 'status',
        type: FieldType.Select,
        config: { options: ['open', 'in_progress', 'done', 'blocked'] },
      },
      { name: 'due', type: FieldType.Date },
      { name: 'assignee', type: FieldType.User },
      {
        name: 'priority',
        type: FieldType.Select,
        config: { options: ['low', 'medium', 'high'] },
      },
    ],
  },
  {
    // #meeting extends #event-like fields directly; kept flat here to avoid a synthetic
    // #event seed. `attendees` is a multi-relation to #person.
    name: 'meeting',
    icon: '📅',
    color: '#db2777',
    fields: [
      { name: 'date', type: FieldType.Date },
      { name: 'location', type: FieldType.Text },
      { name: 'attendees', type: FieldType.Relation, config: { targetTagName: 'person' } },
      { name: 'agenda', type: FieldType.Text },
    ],
  },
];
