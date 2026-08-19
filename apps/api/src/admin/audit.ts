import { db } from '@crudd/database';

/**
 * Append-only audit logging (directive #27).
 * Never store secrets or Supabase tokens in metadata.
 */
export async function recordAudit(params: {
  adminUserId: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        adminUserId: params.adminUserId,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        metadata: (params.metadata ?? undefined) as any,
      },
    });
  } catch (err) {
    // Audit logging must never break the primary operation.
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log:', err);
  }
}
