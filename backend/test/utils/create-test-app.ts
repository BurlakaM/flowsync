import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  OBJECT_STORE,
  type ObjectStore,
} from '../../src/common/storage/object-store';
import {
  MAIL_TRANSPORT,
  type MailTransport,
} from '../../src/modules/mail/mail.service';

/**
 * The real AppModule with the real global configuration (prefix, pipes, CORS, helmet).
 * `mailTransport` replaces the SMTP connection with a fake one that tests can inspect; without it
 * the test environment has no email settings, so nothing is sent. `objectStore` does the same for the
 * file storage (without it uploads answer 503).
 */
export async function createTestApp(
  options: { mailTransport?: MailTransport; objectStore?: ObjectStore } = {},
): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.mailTransport) {
    builder.overrideProvider(MAIL_TRANSPORT).useValue(options.mailTransport);
  }
  if (options.objectStore) {
    builder.overrideProvider(OBJECT_STORE).useValue(options.objectStore);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
