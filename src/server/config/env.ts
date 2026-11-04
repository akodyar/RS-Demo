import dotenv from 'dotenv';

dotenv.config();

export interface ServerConfig {
  nodeEnv: 'development' | 'test' | 'staging' | 'production';
  port: number;
  appUrl: string;
  allowedOrigins: string[];
  database: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    database?: string;
    url?: string;
    ssl: boolean;
    poolMax: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  redis: {
    host?: string;
    port: number;
    password?: string;
    tls: boolean;
    enabled: boolean;
  };
  ai: {
    geminiApiKey?: string;
    enabled: boolean;
  };
  email: {
    configured: boolean;
  };
  sms: {
    configured: boolean;
  };
  push: {
    configured: boolean;
  };
  storage: {
    provider: 's3' | 'gcs' | 'local_vault';
    bucket?: string;
    region?: string;
    configured: boolean;
    signingConfigured: boolean;
    signingSecretStatus: 'SECRET_PRESENT' | 'SECRET_MISSING' | 'SECRET_INVALID';
  };
  auth: {
    jwtSecretConfigured: boolean;
  };
}

export function loadServerConfig(): ServerConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as ServerConfig['nodeEnv'];
  const isProduction = nodeEnv === 'production';

  // Origins parsing
  const rawOrigins = process.env.ALLOWED_ORIGIN || process.env.APP_URL || 'http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

  // Database config
  const dbUrl = process.env.DATABASE_URL;
  const dbHost = process.env.SQL_HOST || '127.0.0.1';
  const dbName = process.env.SQL_DB_NAME || 'homehub_production';
  const dbUser = process.env.DB_APP_USER || process.env.SQL_USER || 'homehub_app';
  const rawDbPassword = process.env.DB_APP_PASSWORD || process.env.DB_PASSWORD || process.env.SQL_PASSWORD;
  
  if (isProduction) {
    if (!dbUrl && (!rawDbPassword || rawDbPassword.trim().length === 0)) {
      throw new Error('[SECURITY] Missing required database password in production environment. Fail-closed enforced.');
    }
    if (rawDbPassword === 'postgres' || rawDbPassword === 'homehub_app_secret_pass') {
      throw new Error('[SECURITY] Insecure default or placeholder database password forbidden in production. Fail-closed enforced.');
    }
  }

  const dbPassword = rawDbPassword || (isProduction ? '' : 'postgres');
  const dbPort = parseInt(process.env.SQL_PORT || '5432', 10);
  const dbSsl = isProduction || process.env.DATABASE_SSL === 'true';

  // Redis config
  const redisHost = process.env.REDIS_HOST;
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisTls = process.env.REDIS_TLS === 'true';
  const redisEnabled = Boolean(redisHost);

  // AI config
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Storage config & signing secret validation
  const storageProvider = (process.env.STORAGE_PROVIDER as 's3' | 'gcs' | 'local_vault') || 'local_vault';
  const storageBucket = process.env.STORAGE_BUCKET;
  const storageRegion = process.env.STORAGE_REGION || 'me-south-1'; // Middle East region

  const storageSigningSecret = process.env.STORAGE_SIGNING_SECRET;
  let signingSecretStatus: 'SECRET_PRESENT' | 'SECRET_MISSING' | 'SECRET_INVALID';
  if (!storageSigningSecret || storageSigningSecret.trim().length === 0) {
    signingSecretStatus = 'SECRET_MISSING';
  } else if (
    storageSigningSecret.trim().length < 32 ||
    (process.env.JWT_SECRET && storageSigningSecret === process.env.JWT_SECRET) ||
    (process.env.SESSION_SECRET && storageSigningSecret === process.env.SESSION_SECRET) ||
    (process.env.SQL_PASSWORD && storageSigningSecret === process.env.SQL_PASSWORD) ||
    (process.env.DB_PASSWORD && storageSigningSecret === process.env.DB_PASSWORD) ||
    (isProduction && ['homehub-secure-storage-signing-key', 'dev-local-storage-signing-secret-do-not-use-in-prod'].includes(storageSigningSecret))
  ) {
    signingSecretStatus = 'SECRET_INVALID';
  } else {
    signingSecretStatus = 'SECRET_PRESENT';
  }

  const signingConfigured = isProduction ? signingSecretStatus === 'SECRET_PRESENT' : true;
  const storageConfigured = Boolean((storageBucket || storageProvider === 'local_vault') && signingConfigured);

  // Authentication config (PostgreSQL Native JWT)
  const rawJwtSecret = process.env.JWT_SECRET;
  if (isProduction) {
    if (!rawJwtSecret || rawJwtSecret.trim().length === 0) {
      throw new Error('[SECURITY] Missing required JWT_SECRET in production environment. Fail-closed enforced.');
    }
    if (rawJwtSecret.trim().length < 32) {
      throw new Error('[SECURITY] JWT_SECRET must be at least 32 characters in production. Fail-closed enforced.');
    }
  }
  const jwtSecretConfigured = Boolean(rawJwtSecret && rawJwtSecret.trim().length >= 32);

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    allowedOrigins,
    database: {
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      url: dbUrl,
      ssl: dbSsl,
      poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '10000', 10),
    },
    redis: {
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      tls: redisTls,
      enabled: redisEnabled,
    },
    ai: {
      geminiApiKey,
      enabled: Boolean(geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY'),
    },
    email: {
      configured: Boolean(process.env.SMTP_HOST || process.env.SES_ACCESS_KEY_ID || process.env.SENDGRID_API_KEY),
    },
    sms: {
      configured: Boolean(process.env.IRAQI_SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN),
    },
    push: {
      configured: Boolean(process.env.FCM_SERVER_KEY || process.env.FIREBASE_MESSAGING_CERT),
    },
    storage: {
      provider: storageProvider,
      bucket: storageBucket,
      region: storageRegion,
      configured: storageConfigured,
      signingConfigured,
      signingSecretStatus,
    },
    auth: {
      jwtSecretConfigured,
    },
  };
}

export function getSanitizedConfigSummary(config: ServerConfig): Record<string, any> {
  return {
    nodeEnv: config.nodeEnv,
    port: config.port,
    appUrl: config.appUrl,
    allowedOrigins: config.allowedOrigins,
    database: {
      configured: Boolean(config.database.url || (config.database.host && config.database.database)),
      host: config.database.host ? '[CONFIGURED]' : '[UNCONFIGURED]',
      port: config.database.port,
      user: config.database.user ? '[CONFIGURED]' : '[UNCONFIGURED]',
      password: config.database.password ? '[REDACTED]' : '[UNCONFIGURED]',
      database: config.database.database || '[UNCONFIGURED]',
      ssl: config.database.ssl,
      poolMax: config.database.poolMax,
    },
    redis: {
      enabled: config.redis.enabled,
      host: config.redis.host ? '[CONFIGURED]' : '[UNCONFIGURED]',
      port: config.redis.port,
      password: config.redis.password ? '[REDACTED]' : '[UNCONFIGURED]',
      tls: config.redis.tls,
    },
    ai: {
      enabled: config.ai.enabled,
      apiKey: config.ai.geminiApiKey ? '[REDACTED]' : '[UNCONFIGURED]',
    },
    storage: {
      provider: config.storage.provider,
      bucket: config.storage.bucket || '[LOCAL_SECURE_VAULT]',
      region: config.storage.region,
      configured: config.storage.configured,
      signingSecret: config.storage.signingSecretStatus === 'SECRET_PRESENT' ? '[CONFIGURED]' : '[UNCONFIGURED]',
      signingStatus: config.storage.signingSecretStatus,
    },
    auth: {
      jwtSecret: config.auth.jwtSecretConfigured ? '[CONFIGURED]' : '[UNCONFIGURED]',
    },
    providers: {
      emailConfigured: config.email.configured,
      smsConfigured: config.sms.configured,
      pushConfigured: config.push.configured,
    },
  };
}

export const serverConfig = loadServerConfig();
