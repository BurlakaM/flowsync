import {Controller, Post, Body, Req, UnauthorizedException} from '@nestjs/common';
import {AuthService} from './auth.service';
import {LoginDto} from './login.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        const user = await this.authService.validateUser(loginDto);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.authService.login(user);
    }

    @Post('validate-token')
    async validateToken(@Body('token') token: string) {
        const isValid = await this.authService.validateToken(token);
        return {valid: isValid};
    }
}
