import { createTransport } from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';
import { createMailTransport, MailService } from './mail.service';

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: vi.fn() })),
}));

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    mailEnabled: false,
    mailFrom: undefined,
    smtp: {
      host: undefined,
      port: 587,
      secure: false,
      user: undefined,
      password: undefined,
    },
    ...overrides,
  }) as unknown as AppConfigService;

const message = { to: 'ann@example.test', subject: 'Hi', text: 'Hello' };

describe('createMailTransport', () => {
  beforeEach(() => vi.mocked(createTransport).mockClear());

  it('creates no connection while email is not configured', () => {
    expect(createMailTransport(config())).toBeNull();
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('connects to the configured server, with the login when there is one', () => {
    createMailTransport(
      config({
        mailEnabled: true,
        smtp: {
          host: 'smtp.example.test',
          port: 465,
          secure: true,
          user: 'user',
          password: 'secret',
        },
      }),
    );

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
      auth: { user: 'user', pass: 'secret' },
    });
  });

  it('does not send an auth block to servers without a login', () => {
    createMailTransport(
      config({
        mailEnabled: true,
        smtp: { host: 'mailpit', port: 1025, secure: false },
      }),
    );

    expect(vi.mocked(createTransport).mock.calls[0][0]).not.toHaveProperty(
      'auth',
    );
  });
});

describe('MailService', () => {
  it('does nothing, and does not fail, while email is not configured', async () => {
    const service = new MailService(config(), null);

    expect(service.enabled).toBe(false);
    await expect(service.send(message)).resolves.toEqual({
      sent: false,
      reason: 'not-configured',
    });
  });

  it('sends through the transport from the configured sender', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const service = new MailService(
      config({
        mailEnabled: true,
        mailFrom: 'FlowSync <noreply@example.test>',
      }),
      { sendMail },
    );

    expect(service.enabled).toBe(true);
    await expect(service.send(message)).resolves.toEqual({ sent: true });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'FlowSync <noreply@example.test>',
      to: 'ann@example.test',
      subject: 'Hi',
      text: 'Hello',
    });
  });

  it('lets a delivery failure through, so that the queue can retry', async () => {
    const service = new MailService(config({ mailEnabled: true }), {
      sendMail: vi.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(service.send(message)).rejects.toThrow('connection refused');
  });

  it.each([
    ['both settings are missing', config()],
    [
      'only the server is set (a warning is logged)',
      config({ smtp: { host: 'smtp.example.test', port: 587, secure: false } }),
    ],
    ['email is on', config({ mailEnabled: true, smtp: { host: 'smtp' } })],
  ])('starts up when %s', (_name, appConfig) => {
    const service = new MailService(
      appConfig,
      appConfig.mailEnabled ? { sendMail: vi.fn() } : null,
    );

    expect(() => service.onModuleInit()).not.toThrow();
  });
});
