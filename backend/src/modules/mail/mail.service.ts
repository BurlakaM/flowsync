import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** The one thing the application needs from a mail server connection (nodemailer's transport fits). */
export interface MailTransport {
  sendMail(options: {
    from?: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
}

/** Injection token of the SMTP transport; null while email is not configured. Tests replace it. */
export const MAIL_TRANSPORT = 'MAIL_TRANSPORT';

/** Builds the real SMTP transport from the settings, or none when email is switched off. */
export function createMailTransport(
  config: AppConfigService,
): MailTransport | null {
  if (!config.mailEnabled) return null;
  const { host, port, secure, user, password } = config.smtp;
  return createTransport({
    host,
    port,
    secure,
    // Servers without a login (a local Mailpit) get no auth block at all.
    ...(user && { auth: { user, pass: password ?? '' } }),
  });
}

export type SendResult =
  { sent: true } | { sent: false; reason: 'not-configured' };

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: AppConfigService,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport | null,
  ) {}

  /** False until SMTP_HOST and MAIL_FROM are set in the environment. */
  get enabled(): boolean {
    return this.transport !== null;
  }

  onModuleInit(): void {
    if (this.enabled) {
      this.logger.log(`Email is on (server ${this.config.smtp.host}).`);
    } else if (this.config.smtp.host && !this.config.mailFrom) {
      this.logger.warn(
        'SMTP_HOST is set but MAIL_FROM is not: email stays off until both are set.',
      );
    } else {
      this.logger.log(
        'Email is off (SMTP_HOST and MAIL_FROM are not set): notifications appear only in the application.',
      );
    }
  }

  /**
   * Sends one message. Without configuration it does nothing and says so; with configuration a
   * delivery failure is thrown, so the queue can retry it.
   */
  async send(message: MailMessage): Promise<SendResult> {
    if (!this.transport) {
      this.logger.debug(`Email is off: "${message.subject}" was not sent.`);
      return { sent: false, reason: 'not-configured' };
    }
    await this.transport.sendMail({
      from: this.config.mailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { sent: true };
  }
}
