import rateLimit from 'express-rate-limit';

/**
 * HOMEHUB AUTHENTICATION RATE LIMITING MIDDLEWARE
 * Tiered abuse protection for sensitive authentication ingress routes.
 * 
 * Invariants:
 * 1. Standard RFC 6585/7231 headers (RateLimit-*, Retry-After).
 * 2. Conservative limits in production with environment variable overrides.
 * 3. Permissive limits in test/development to avoid slowing down valid test suites.
 * 4. Distinct limits for login (brute-force/credential stuffing), registration (bot spam),
 *    and password recovery (inbox spam / quota exhaustion).
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Rate limiter for POST /api/auth/login
 * Defends against rapid-fire brute force and credential stuffing.
 * Production: 10 requests per 15 minutes per IP.
 * Test/Dev: 100 requests per 15 minutes per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || (isProduction ? '10' : '100'), 10),
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many login attempts from this IP address. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: true,
  },
});

/**
 * Rate limiter for POST /api/auth/register
 * Defends against automated bulk account creation / bot registration spam.
 * Production: 5 requests per hour per IP.
 * Test/Dev: 50 requests per hour per IP.
 */
export const registerRateLimiter = rateLimit({
  windowMs: parseInt(process.env.REGISTER_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
  max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX || (isProduction ? '5' : '50'), 10),
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many registration requests from this IP address. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: true,
  },
});

/**
 * Rate limiter for POST /api/auth/forgot-password and POST /api/auth/reset-password
 * Defends against email bombing, provider quota exhaustion, and token brute force.
 * Production: 5 requests per 15 minutes per IP.
 * Test/Dev: 50 requests per 15 minutes per IP.
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || (isProduction ? '5' : '50'), 10),
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many password reset requests from this IP address. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: true,
  },
});
