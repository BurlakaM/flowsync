import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsListener],
})
export class NotificationsModule {}
