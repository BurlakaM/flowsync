import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  NotificationPageDto,
  QueryNotificationsDto,
  UnreadCountDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOkResponse({ type: NotificationPageDto })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notifications.list(user.id, query);
  }

  @ApiOkResponse({ type: UnreadCountDto })
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @Post(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notifications.markRead(user.id, id);
  }
}
