import { getDb } from './db';
import { auditLogs } from './schema';

type AuditInput = {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export async function audit(input: AuditInput) {
  try {
    await getDb().insert(auditLogs).values({
      actorId: input.actorId || null,
      action: input.action,
      targetType: input.targetType || null,
      targetId: input.targetId || null,
      ip: input.ip || null,
      userAgent: input.userAgent || null,
      metadata: input.metadata || {},
    });
  } catch (err) {
    console.error('[audit] insert failed:', err instanceof Error ? err.message : 'unknown');
  }
}
