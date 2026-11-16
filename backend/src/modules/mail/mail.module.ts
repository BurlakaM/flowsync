import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { MailQueueService } from './mail-queue.service';
import {
  createMailTransport,
  MAIL_TRANSPORT,
  MailService,
} from './mail.service';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [AppConfigService],
      useFactory: createMailTransport,
    },
    MailService,
    MailQueueService,
  ],
  exports: [MailQueueService],
})
export class MailModule {}
