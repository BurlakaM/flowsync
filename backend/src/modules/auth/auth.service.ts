import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

interface TokenSubject {
  id: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  register(dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  me(userId: number) {
    return this.usersService.getProfile(userId);
  }

  /** Returns the user (without the password hash) when the credentials are valid. */
  async validateUser(dto: LoginDto): Promise<TokenSubject | null> {
    const user = await this.usersService.findByEmailForAuth(dto.email);
    if (!user) return null;
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) return null;
    return { id: user.id, email: user.email };
  }

  login(user: TokenSubject) {
    const payload = { email: user.email, sub: user.id };
    return { access_token: this.jwtService.sign(payload) };
  }

  /** Deprecated: the frontend uses it until plan phase 6 replaces it with GET /auth/me. */
  validateToken(token: string): boolean {
    try {
      return !!this.jwtService.verify(token);
    } catch {
      return false;
    }
  }
}
