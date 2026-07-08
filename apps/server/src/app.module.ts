import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { dataSourceOptions } from './database/data-source';
import { TenantContextService } from './common/tenant-context.service';
import { AiModule } from './modules/ai/ai.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MembershipModule } from './modules/membership/membership.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { TagModule } from './modules/tag/tag.module';
import { BlockModule } from './modules/block/block.module';
import { ViewModule } from './modules/view/view.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { SyncModule } from './modules/sync/sync.module';
import { HealthModule } from './modules/health/health.module';
import { FieldModule } from './modules/field/field.module';
import { LinkingModule } from './modules/linking/linking.module';
import { CaptureModule } from './modules/capture/capture.module';
import { CurationModule } from './modules/curation/curation.module';
import { WorkersModule } from './modules/jobs/workers.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { GraphModule } from './modules/graph/graph.module';
import { SpaceModule } from './modules/space/space.module';

/**
 * Root module wiring the domain-focused feature modules (§3). Global modules (AI, Jobs,
 * Membership) are available everywhere; the rest are imported explicitly.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Structured logging (§12). Pretty-print only outside production.
        transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
      },
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    // Global infra
    AiModule,
    JobsModule,
    MembershipModule,
    // Feature modules
    AuthModule,
    TenantModule,
    SpaceModule,
    TagModule,
    FieldModule,
    BlockModule,
    ViewModule,
    EmbeddingModule,
    LinkingModule,
    ApprovalModule,
    CaptureModule,
    CurationModule,
    GraphModule,
    UploadsModule,
    SyncModule,
    WorkersModule,
    HealthModule,
  ],
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class AppModule {}
