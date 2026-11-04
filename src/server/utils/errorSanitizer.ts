import { Response } from 'express';
import crypto from 'node:crypto';

export function sendSafeError(
  res: Response, 
  error: any, 
  defaultStatus: number = 500, 
  userFriendlyMessage: string = 'An unexpected error occurred.'
) {
  // 1. Detect Database fail-closed conditions
  const isDbUnavail = 
    error?.status === 503 || 
    error?.code === 'ECONNREFUSED' || 
    error?.code === '57P01' || // admin_shutdown
    error?.code === '57P02' || // crash_shutdown
    error?.code === '57P03' || // cannot_connect_now
    error?.message?.includes('ECONNREFUSED') || 
    error?.message?.includes('DATABASE_NOT_CONFIGURED') ||
    error?.message?.includes('unreachable') ||
    error?.cause?.code === 'ECONNREFUSED' ||
    String(error?.cause || '').includes('ECONNREFUSED') ||
    String(error || '').includes('ECONNREFUSED');

  if (isDbUnavail) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      code: 'DATABASE_NOT_CONFIGURED',
      message: 'The authoritative relational storage service is unreachable. Fail-closed enforced.',
    });
  }

  // 2. Sensitive error detection (Never leak SQL, tables, schema, params, stack traces)
  const rawMsg = String(error?.message || '');
  const isSensitive = 
    rawMsg.includes('Failed query:') ||
    rawMsg.includes('drizzle') ||
    rawMsg.includes('syntax error at or near') ||
    rawMsg.includes('violates foreign key constraint') ||
    rawMsg.includes('violates not-null constraint') ||
    rawMsg.includes('violates unique constraint') ||
    rawMsg.includes('relation "') ||
    rawMsg.includes('column "') ||
    rawMsg.includes('SELECT ') ||
    rawMsg.includes('INSERT ') ||
    rawMsg.includes('UPDATE ') ||
    rawMsg.includes('DELETE ') ||
    rawMsg.includes('password') ||
    rawMsg.includes('token') ||
    rawMsg.includes('at /') ||
    rawMsg.includes('at C:\\') ||
    rawMsg.includes('.ts:') ||
    rawMsg.includes('.js:');

  const status = error?.status && typeof error.status === 'number' && error.status >= 400 && error.status < 600
    ? error.status
    : defaultStatus;

  const safeMessage = isSensitive ? userFriendlyMessage : (rawMsg || userFriendlyMessage);
  const correlationId = error?.correlationId || crypto.randomUUID();

  return res.status(status).json({
    error: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
    message: safeMessage,
    correlationId,
  });
}
