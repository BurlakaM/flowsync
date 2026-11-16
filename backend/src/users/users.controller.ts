import {Controller, Post, Body, Get, UseGuards} from '@nestjs/common';
import {UserService} from './users.service';
import {UserDto} from './user.dto';
import {JwtAuthGuard} from '../conception/jwt.auth.guard';
import {CurrentUser} from '../common/decorators/current-user.decorator';
import {AuthenticatedUser} from '../common/types/authenticated-user.type';

@Controller('users')
export class UserController {
    constructor(private userService: UserService) {
    }

    // Public on purpose: registration.
    @Post()
    createUser(@Body() dto: UserDto) {
        return this.userService.createUser(dto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@CurrentUser() user: AuthenticatedUser) {
        return this.userService.getProfile(user.id);
    }
}
