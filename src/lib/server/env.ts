const required = (name: string, fallback?: string) => {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const serverEnv = {
  get appEnv() {
    return process.env.APP_ENV || process.env.NODE_ENV || 'development';
  },
  get isProduction() {
    return this.appEnv === 'production';
  },
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  get redisUrl() {
    return process.env.REDIS_URL || '';
  },
  get authSecret() {
    const value = required('AUTH_SECRET');
    if (value.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
    return value;
  },
  get storageSecret() {
    const value = required('STORAGE_SECRET');
    if (value.length < 32) throw new Error('STORAGE_SECRET must be at least 32 characters');
    return value;
  },
  get storageDriver() {
    return process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
  },
  get dataDir() {
    return process.env.DATA_DIR || '/opt/baolimei/data';
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  },
  get allowedOrigins() {
    return (process.env.ALLOWED_ORIGINS || this.siteUrl)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  },
  get cookieSecure() {
    return process.env.COOKIE_SECURE === 'true';
  },
  get smsProvider() {
    return process.env.SMS_PROVIDER || '';
  },
  get allowDevSms() {
    return process.env.ALLOW_DEV_SMS === '1' && !this.isProduction;
  },
  get allowDevSmsResponse() {
    return process.env.ALLOW_DEV_SMS_RESPONSE === '1' && !this.isProduction;
  },
  get mockGenerationEnabled() {
    return process.env.MOCK_GENERATION_ENABLED === '1' && !this.isProduction;
  },
  get workerEnabled() {
    return process.env.WORKER_ENABLED !== '0';
  },
  get s3() {
    return {
      endpoint: process.env.S3_ENDPOINT || '',
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    };
  },
};
