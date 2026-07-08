import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MembershipRole } from '@zettra/shared';

/** Membership — a user's role in a space (§6.1, §8.8). Authority for space-level access. */
@Entity('membership')
@Index(['spaceId', 'userId'], { unique: true })
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  spaceId!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'enum', enum: MembershipRole })
  role!: MembershipRole;
}
