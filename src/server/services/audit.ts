import { AuditLog, UserRole, CompanyRole } from '../../types';
import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema.js';

/**
 * AUDIT LOGGING FOUNDATION
 * Provides immutable-oriented logging for critical security and domain actions.
 * Persists to PostgreSQL audit_logs table when DB is configured, with fail-closed
 * enforcement in production environments.
 */
class AuditService {
  /**
   * Logs a security or business critical action.
   * Authoritatively persists to the database when configured.
   */
  async logAction(params: {
    actorUserId: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId: string;
    changes?: Record<string, any>;
    ipAddress?: string | string[];
    tx?: any;
  }): Promise<AuditLog> {
    const entry: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...params,
      ipAddress: Array.isArray(params.ipAddress) ? params.ipAddress[0] : (params.ipAddress || ''),
      changes: params.changes || {},
    };

    // Console stream log
    console.log(`[AUDIT] ${entry.timestamp} | User: ${entry.actorUserId} | Role: ${entry.actorRole} | Action: ${entry.action} | Resource: ${entry.resourceType}#${entry.resourceId}`);

    // Persist to PostgreSQL if configured
    const isDbConfigured = Boolean(process.env.DATABASE_URL || (process.env.SQL_HOST && process.env.SQL_DB_NAME));
    if (isDbConfigured) {
      const executor = params.tx || db;
      try {
        await (executor as any).insert(auditLogs).values({
          id: entry.id,
          timestamp: new Date(entry.timestamp),
          actorUserId: entry.actorUserId,
          actorRole: entry.actorRole,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          changes: entry.changes,
          ipAddress: entry.ipAddress,
        });
      } catch (dbErr: any) {
        console.error('[AUDIT DB INSERT FAILED]:', dbErr?.message || dbErr);
        if (params.tx || process.env.NODE_ENV === 'production') {
          throw new Error('AUDIT_PERSISTENCE_FAILED: Failed to record authoritative audit log in database.');
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[AUDIT WARNING] Production running without database persistence configured.');
    }

    return entry;
  }
}

export const auditService = new AuditService();
