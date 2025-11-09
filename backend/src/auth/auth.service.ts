import {Injectable} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {UserService} from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import {LoginDto} from "./login.dto";

@Injectable()
export class AuthService {
    constructor(
        private usersService: UserService,
        private jwtService: JwtService,
    ) {
    }

    async validateUser(dto: LoginDto): Promise<any> {
        const user = await this.usersService.findUserByEmail(dto.email);
        if (!user) return null;
        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) return null;
        const {password, ...result} = user;
        return result;
    }

    async login(user: any) {
        const payload = {email: user.email, sub: user.id};
        return {
            access_token: this.jwtService.sign(payload, { expiresIn: '1h' }),
        };
    }

    async validateToken(token: string): Promise<boolean> {
        try {
            const decoded = this.jwtService.verify(token);
            return !!decoded;
        } catch (error) {
            return false;
        }
    }
}
