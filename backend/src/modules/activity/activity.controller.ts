import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ActivityService } from './activity.service';
import { ActivityPageDto } from './dto/activity-response.dto';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('projects/:projectId/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @ApiOkResponse({ type: ActivityPageDto })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.activity.list(user.id, projectId, query);
  }
}
