/** Entity barrel + the canonical list handed to TypeORM. */
import { ApprovalPolicy } from './approval-policy.entity';
import { Block } from './block.entity';
import { BlockEmbedding } from './block-embedding.entity';
import { BlockRelation } from './block-relation.entity';
import { BlockTag } from './block-tag.entity';
import { FieldValue } from './field-value.entity';
import { Membership } from './membership.entity';
import { Notification } from './notification.entity';
export type { NotificationKind } from './notification.entity';
import { Reminder } from './reminder.entity';
import { Space } from './space.entity';
import { Tag } from './tag.entity';
import { TagField } from './tag-field.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
import { UserBlockState } from './user-block-state.entity';
import { View } from './view.entity';

export {
  ApprovalPolicy,
  Block,
  BlockEmbedding,
  BlockRelation,
  BlockTag,
  FieldValue,
  Membership,
  Notification,
  Reminder,
  Space,
  Tag,
  TagField,
  Tenant,
  User,
  UserBlockState,
  View,
};

export const ALL_ENTITIES = [
  Tenant,
  User,
  Space,
  Membership,
  Block,
  Tag,
  TagField,
  BlockTag,
  FieldValue,
  BlockRelation,
  BlockEmbedding,
  View,
  ApprovalPolicy,
  UserBlockState,
  Notification,
  Reminder,
];
