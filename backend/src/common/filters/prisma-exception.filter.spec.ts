import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function createHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ originalUrl: '/api/users?x=1' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('maps a unique violation (P2002) to 409 and names the field', () => {
    const { host, status, json } = createHost();

    filter.catch(prismaError('P2002', { target: ['email'] }), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A record with this email already exists',
      }),
    );
  });

  it('maps a missing record (P2025) to 404', () => {
    const { host, status } = createHost();

    filter.catch(prismaError('P2025'), host);

    expect(status).toHaveBeenCalledWith(404);
  });

  it('maps a foreign key violation (P2003) to 409', () => {
    const { host, status } = createHost();

    filter.catch(prismaError('P2003'), host);

    expect(status).toHaveBeenCalledWith(409);
  });

  it('turns any other Prisma error into a generic 500 without details', () => {
    const { host, status, json } = createHost();

    filter.catch(prismaError('P2000'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].message).toBe('Internal server error');
  });
});
