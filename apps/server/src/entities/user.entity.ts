import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** User — a member of exactly one tenant in v1 (§5). Authenticates via the pluggable auth. */
@Entity('user')
@Index(['tenantId', 'email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', nullable: true })
  displayName!: string | null;

  /** Argon2/bcrypt hash for the email+password provider. Null for OIDC-only users. */
  @Column({ type: 'text', nullable: true, select: false })
  passwordHash!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
