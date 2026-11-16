import { validateEnv } from './env.schema';

const valid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'secret',
};

describe('validateEnv', () => {
  it('applies defaults to optional variables', () => {
    expect(validateEnv(valid)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      JWT_EXPIRES_IN: '15m',
      REFRESH_TOKEN_TTL_DAYS: 7,
      COOKIE_SECURE: false,
      TRUST_PROXY: 0,
      LOG_LEVEL: 'info',
      BCRYPT_ROUNDS: 10,
    });
  });

  it('reads the cookie flag and keeps the session length in range', () => {
    expect(validateEnv({ ...valid, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(
      true,
    );
    expect(() => validateEnv({ ...valid, COOKIE_SECURE: 'yes' })).toThrow(
      /COOKIE_SECURE/,
    );
    expect(() =>
      validateEnv({ ...valid, REFRESH_TOKEN_TTL_DAYS: '0' }),
    ).toThrow(/REFRESH_TOKEN_TTL_DAYS/);
  });

  it('keeps the bcrypt cost between 4 and 15', () => {
    expect(validateEnv({ ...valid, BCRYPT_ROUNDS: '4' }).BCRYPT_ROUNDS).toBe(4);
    expect(() => validateEnv({ ...valid, BCRYPT_ROUNDS: '3' })).toThrow(
      /BCRYPT_ROUNDS/,
    );
    expect(() => validateEnv({ ...valid, BCRYPT_ROUNDS: '16' })).toThrow(
      /BCRYPT_ROUNDS/,
    );
  });

  it('coerces numeric variables from strings', () => {
    expect(
      validateEnv({ ...valid, PORT: '8080', TRUST_PROXY: '1' }),
    ).toMatchObject({ PORT: 8080, TRUST_PROXY: 1 });
  });

  it('reports every missing required variable at once', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });

  it('rejects a database URL that is not PostgreSQL', () => {
    expect(() =>
      validateEnv({ ...valid, DATABASE_URL: 'mysql://u:p@localhost/db' }),
    ).toThrow(/DATABASE_URL: must be a PostgreSQL connection URL/);
  });

  it('rejects a malformed token lifetime', () => {
    expect(() => validateEnv({ ...valid, JWT_EXPIRES_IN: 'soon' })).toThrow(
      /JWT_EXPIRES_IN/,
    );
  });

  it('rejects a short JWT secret in production', () => {
    expect(() =>
      validateEnv({ ...valid, NODE_ENV: 'production', JWT_SECRET: 'short' }),
    ).toThrow(/JWT_SECRET: must be at least 32 characters in production/);
  });

  it('accepts a long JWT secret in production', () => {
    const env = validateEnv({
      ...valid,
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(32),
    });
    expect(env.NODE_ENV).toBe('production');
  });

  it('drops variables that are not part of the schema', () => {
    expect(validateEnv({ ...valid, PATH: '/usr/bin' })).not.toHaveProperty(
      'PATH',
    );
  });
});
