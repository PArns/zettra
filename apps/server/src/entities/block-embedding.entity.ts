import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * BlockEmbedding — one embedding per block chunk (§6.1). The `embedding vector(1024)` column
 * is created by the raw pgvector migration; TypeORM has no vector type, so it is declared
 * here as non-managed (insert/update/select false) and all vector I/O goes through raw SQL
 * in the similarity/embedding services.
 */
@Entity('block_embedding')
@Index(['blockId', 'chunkIndex', 'model'], { unique: true })
export class BlockEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  blockId!: string;

  /** Long blocks chunk into several vectors. */
  @Column({ type: 'int', default: 0 })
  chunkIndex!: number;

  /** e.g. `bge-m3`; enables re-embedding on model change. */
  @Column({ type: 'text' })
  model!: string;

  /**
   * The pgvector column. Not managed by the ORM — see class doc. Present so the entity maps
   * the physical column; reads/writes use parameterized raw SQL with `::vector` casts.
   */
  @Column({ type: 'text', insert: false, update: false, select: false })
  embedding?: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
