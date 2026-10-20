import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 20 }).notNull(),
    name: varchar('name', { length: 60 }),
    passwordHash: text('password_hash'),
    avatarAssetId: uuid('avatar_asset_id'),
    role: varchar('role', { length: 20 }).default('user').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    phoneUq: uniqueIndex('users_phone_uq').on(t.phone),
    statusIdx: index('users_status_idx').on(t.status),
  })
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    csrfHash: varchar('csrf_hash', { length: 64 }).notNull(),
    userAgent: text('user_agent'),
    ip: varchar('ip', { length: 45 }),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    tokenUq: uniqueIndex('user_sessions_token_uq').on(t.tokenHash),
    userIdx: index('user_sessions_user_idx').on(t.userId),
    expiresIdx: index('user_sessions_expires_idx').on(t.expiresAt),
  })
);

export const verificationChallenges = pgTable(
  'verification_challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 20 }).notNull(),
    purpose: varchar('purpose', { length: 20 }).notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => ({
    lookIdx: index('verification_lookup_idx').on(t.phone, t.purpose, t.createdAt),
    expiresIdx: index('verification_expires_idx').on(t.expiresAt),
  })
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    coverAssetId: uuid('cover_asset_id'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('projects_owner_idx').on(t.ownerId, t.updatedAt),
    statusIdx: index('projects_status_idx').on(t.status),
  })
);

export const canvases = pgTable(
  'canvases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).default('主画布').notNull(),
    version: integer('version').default(1).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    nodeCount: integer('node_count').default(0).notNull(),
    edgeCount: integer('edge_count').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    projectUq: uniqueIndex('canvases_project_uq').on(t.projectId),
    updatedIdx: index('canvases_updated_idx').on(t.updatedAt),
  })
);

export const canvasVersions = pgTable(
  'canvas_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    canvasId: uuid('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    label: varchar('label', { length: 80 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => ({
    canvasVersionUq: uniqueIndex('canvas_versions_canvas_version_uq').on(t.canvasId, t.version),
    canvasIdx: index('canvas_versions_canvas_idx').on(t.canvasId, t.version),
  })
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    kind: varchar('kind', { length: 20 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    storageDriver: varchar('storage_driver', { length: 20 }).notNull(),
    storageKey: text('storage_key').notNull(),
    originalName: varchar('original_name', { length: 255 }),
    checksum: varchar('checksum', { length: 64 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    visibility: varchar('visibility', { length: 20 }).default('private').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('assets_owner_idx').on(t.ownerId, t.createdAt),
    projectIdx: index('assets_project_idx').on(t.projectId),
    keyUq: uniqueIndex('assets_storage_key_uq').on(t.storageKey),
    statusIdx: index('assets_status_idx').on(t.status),
  })
);

export const nodes = pgTable(
  'nodes',
  {
    id: varchar('id', { length: 80 }).notNull(),
    canvasId: uuid('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 24 }).notNull(),
    title: varchar('title', { length: 120 }),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    width: doublePrecision('width').notNull(),
    ratio: doublePrecision('ratio'),
    status: varchar('status', { length: 20 }).default('idle').notNull(),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    data: jsonb('data').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.canvasId, t.id] }),
    canvasIdx: index('nodes_canvas_idx').on(t.canvasId),
    assetIdx: index('nodes_asset_idx').on(t.assetId),
  })
);

export const edges = pgTable(
  'edges',
  {
    id: varchar('id', { length: 80 }).notNull(),
    canvasId: uuid('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    sourceId: varchar('source_id', { length: 80 }).notNull(),
    targetId: varchar('target_id', { length: 80 }).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.canvasId, t.id] }),
    canvasIdx: index('edges_canvas_idx').on(t.canvasId),
    sourceIdx: index('edges_source_idx').on(t.sourceId),
    sourceFk: foreignKey({
      columns: [t.canvasId, t.sourceId],
      foreignColumns: [nodes.canvasId, nodes.id],
      name: 'edges_source_fk',
    }).onDelete('cascade'),
    targetFk: foreignKey({
      columns: [t.canvasId, t.targetId],
      foreignColumns: [nodes.canvasId, nodes.id],
      name: 'edges_target_fk',
    }).onDelete('cascade'),
  })
);

export const assetReferences = pgTable(
  'asset_references',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    canvasId: uuid('canvas_id')
      .notNull()
      .references(() => canvases.id, { onDelete: 'cascade' }),
    nodeId: varchar('node_id', { length: 80 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    refUq: uniqueIndex('asset_references_uq').on(t.assetId, t.canvasId, t.nodeId),
    assetIdx: index('asset_references_asset_idx').on(t.assetId),
    canvasIdx: index('asset_references_canvas_idx').on(t.canvasId),
  })
);

export const modelProviders = pgTable(
  'model_providers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    kind: varchar('kind', { length: 30 }).notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    nameUq: uniqueIndex('model_providers_name_uq').on(t.name),
  })
);

export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    canvasId: uuid('canvas_id').references(() => canvases.id, { onDelete: 'set null' }),
    nodeId: varchar('node_id', { length: 80 }),
    providerId: uuid('provider_id').references(() => modelProviders.id, { onDelete: 'set null' }),
    model: varchar('model', { length: 80 }).notNull(),
    kind: varchar('kind', { length: 30 }).notNull(),
    prompt: text('prompt').notNull(),
    params: jsonb('params').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    status: varchar('status', { length: 20 }).default('queued').notNull(),
    progress: integer('progress').default(0).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 120 }),
    error: text('error'),
    resultAssetId: uuid('result_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    cancelRequestedAt: timestamp('cancel_requested_at', { withTimezone: true }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: varchar('locked_by', { length: 80 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    userIdx: index('generation_jobs_user_idx').on(t.userId, t.createdAt),
    statusIdx: index('generation_jobs_status_idx').on(t.status, t.createdAt),
    idemUq: uniqueIndex('generation_jobs_idem_uq').on(t.userId, t.idempotencyKey),
  })
);

export const usageRecords = pgTable(
  'usage_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => generationJobs.id, { onDelete: 'set null' }),
    kind: varchar('kind', { length: 40 }).notNull(),
    credits: integer('credits').default(0).notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index('usage_records_user_idx').on(t.userId, t.createdAt),
  })
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 80 }).notNull(),
    targetType: varchar('target_type', { length: 40 }),
    targetId: varchar('target_id', { length: 80 }),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    actorIdx: index('audit_logs_actor_idx').on(t.actorId, t.createdAt),
    actionIdx: index('audit_logs_action_idx').on(t.action, t.createdAt),
  })
);
