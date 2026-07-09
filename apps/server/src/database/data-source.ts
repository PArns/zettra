import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from '../entities/index';
import { loadConfig } from '../config/configuration';
import { InitialSchema1700000000000 } from './migrations/1700000000000-InitialSchema';
import { Vector1700000000001 } from './migrations/1700000000001-Vector';
import { Rls1700000000002 } from './migrations/1700000000002-Rls';
import { Search1700000000003 } from './migrations/1700000000003-Search';

const config = loadConfig();

/**
 * TypeORM options shared by the Nest app (TypeOrmModule) and the migration CLI.
 * `synchronize` is OFF: schema comes from idempotent migrations run by the server
 * entrypoint before boot (§13.3).
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: config.databaseUrl,
  entities: ALL_ENTITIES,
  migrations: [
    InitialSchema1700000000000,
    Vector1700000000001,
    Rls1700000000002,
    Search1700000000003,
  ],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
};

/** The migration-CLI DataSource. */
export const AppDataSource = new DataSource(dataSourceOptions);
