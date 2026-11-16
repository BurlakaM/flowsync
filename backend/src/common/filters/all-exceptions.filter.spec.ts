import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createHost(path = '/api/example') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ originalUrl: path }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('keeps the status and message of an HttpException', () => {
    const { host, status, json } = createHost('/api/tasks');

    filter.catch(new ForbiddenException('Insufficient role'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient role',
        path: '/api/tasks',
      }),
    );
  });

  it('passes validation messages through as an array', () => {
    const { host, json } = createHost();

    filter.catch(
      new BadRequestException([
        'email must be an email',
        'name must be a string',
      ]),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ['email must be an email', 'name must be a string'],
      }),
    );
  });

  it('hides the details of an unexpected error behind a generic 500', () => {
    const { host, status, json } = createHost();

    filter.catch(new Error('connection string postgresql://secret'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});
