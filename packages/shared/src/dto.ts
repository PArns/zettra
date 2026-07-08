/**
 * HTTP DTOs — the wire contract between client and server. Kept framework-agnostic here;
 * the server re-declares validated versions (class-validator) that structurally match.
 */
import { BlockSource, FieldType, MembershipRole, ViewLayout } from './enums';
import { ViewFilter, ViewSort } from './views';

export interface AuthCredentialsDto {
  email: string;
  password: string;
}

export interface AuthTokenDto {
  accessToken: string;
  user: UserDto;
}

export interface UserDto {
  id: string;
  tenantId: string;
  email: string;
  displayName: string | null;
}

export interface CreateBlockDto {
  spaceId: string;
  parentId?: string | null;
  content?: unknown;
  source?: BlockSource;
  sourceRef?: string | null;
}

export interface BlockDto {
  id: string;
  tenantId: string;
  spaceId: string;
  parentId: string | null;
  position: string;
  content: unknown;
  source: BlockSource;
  sourceRef: string | null;
  ownerUserId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  tagIds: string[];
}

export interface CreateTagDto {
  name: string;
  icon?: string;
  color?: string;
  extendsId?: string | null;
  fields?: CreateTagFieldDto[];
}

export interface CreateTagFieldDto {
  name: string;
  type: FieldType;
  config?: Record<string, unknown>;
  position?: number;
}

export interface CreateViewDto {
  name: string;
  spaceId?: string | null;
  tagId?: string | null;
  layout?: ViewLayout;
  filters?: ViewFilter[];
  sorts?: ViewSort[];
  groupBy?: string | null;
}

export interface RelatedBlockDto {
  blockId: string;
  distance: number;
}

export interface CreateMembershipDto {
  spaceId: string;
  userId: string;
  role: MembershipRole;
}
