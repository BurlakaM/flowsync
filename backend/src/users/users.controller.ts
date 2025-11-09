import {Controller, Post, Body, Get, Param} from '@nestjs/common';
import {UserService} from './users.service';
import {UserDto} from './user.dto';

@Controller('users')
export class UserController {
    constructor(private userService: UserService) {
    }

    @Post()
    createUser(@Body() UserDto: UserDto) {
        return this.userService.createUser(UserDto);
    }

    @Get(':email')
    getUserByEmail(@Param('email') email: string) {
        return this.userService.findUserByEmail(email);
    }
}
