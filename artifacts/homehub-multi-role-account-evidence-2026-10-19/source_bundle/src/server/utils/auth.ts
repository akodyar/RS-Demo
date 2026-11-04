import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

export interface AuthTokenPayload {
  id: string;
  email: string;
  roles: string[];
  tokenVersion?: number;
  organizationId?: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET_MISSING_IN_PRODUCTION: JWT_SECRET environment variable is mandatory in production.');
    }
    return 'homehub_default_development_jwt_secret_key_32charsmin!';
  }
  return secret;
}

/**
 * Hash password using Argon2id with OWASP-recommended parameters
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verify plaintext password against Argon2 hash
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/**
 * Sign JWT session token (7 days validity)
 */
export function signAuthToken(payload: AuthTokenPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode JWT session token
 */
export function verifyAuthToken(token: string): AuthTokenPayload {
  const secret = getJwtSecret();
  return jwt.verify(token, secret, { algorithms: ['HS256'] }) as AuthTokenPayload;
}
