import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { storageService, DocumentCategory } from '../services/storage-service.js';
import { loadServerConfig } from '../config/env.js';

const router = Router();

/**
 * POST /api/storage/presigned-upload
 * Issues a cryptographically signed, short-lived upload URL
 */
router.post('/presigned-upload', requireAuth, async (req, res) => {
  const config = loadServerConfig();
  if (!config.storage.configured) {
    return res.status(503).json({
      error: 'STORAGE_NOT_CONFIGURED',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Production document storage is not configured. Fail-closed enforced.',
    });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authenticated user database record required',
    });
  }

  try {
    const { category, fileName, fileSizeBytes, mimeType, sourceEntityId } = req.body;

    if (!category || !fileName || !fileSizeBytes || !mimeType || !sourceEntityId) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing required parameters: category, fileName, fileSizeBytes, mimeType, sourceEntityId',
      });
    }

    const userRoles = req.user?.roles || [];
    const primaryRole = userRoles.find(
      (role: string) => role === 'PLATFORM_ADMIN' || role === 'ADMIN'
    ) || userRoles[0];

    const response = await storageService.generatePresignedUploadUrl({
      userId,
      userRole: primaryRole ? String(primaryRole) : '',
      organizationId: req.user?.organizationId,
      category: category as DocumentCategory,
      fileName,
      fileSizeBytes: Number(fileSizeBytes),
      mimeType,
      sourceEntityId,
    });

    res.json(response);
  } catch (err: any) {
    const isValidationError = err.message?.startsWith('422');
    const isConfigError = err.message?.startsWith('503');
    res.status(isValidationError ? 422 : isConfigError ? 503 : 500).json({
      error: isValidationError ? 'VALIDATION_ERROR' : isConfigError ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR',
      message: err.message,
    });
  }
});

/**
 * POST /api/storage/presigned-download
 * Issues a short-lived signed download URL for private documents
 */
router.post('/presigned-download', requireAuth, async (req, res) => {
  const config = loadServerConfig();
  if (!config.storage.configured) {
    return res.status(503).json({
      error: 'STORAGE_NOT_CONFIGURED',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Production document storage is not configured. Fail-closed enforced.',
    });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authenticated user database record required',
    });
  }

  try {
    const { documentKey } = req.body;
    if (!documentKey) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing required parameter: documentKey',
      });
    }

    const userRoles = req.user?.roles || [];
    const primaryRole = userRoles.find(
      (role: string) => role === 'PLATFORM_ADMIN' || role === 'ADMIN'
    ) || userRoles[0];

    const response = await storageService.generatePresignedDownloadUrl({
      documentKey,
      requestingUserId: userId,
      userRole: primaryRole ? String(primaryRole) : undefined,
      organizationId: req.user?.organizationId,
    });

    res.json(response);
  } catch (err: any) {
    const isForbidden = err.message?.startsWith('403') || err.message?.includes('FORBIDDEN');
    const isConfigError = err.message?.startsWith('503');
    res.status(isForbidden ? 403 : isConfigError ? 503 : 500).json({
      error: isForbidden ? 'FORBIDDEN' : isConfigError ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR',
      message: err.message,
    });
  }
});

export default router;
