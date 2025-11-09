import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { JwtService } from "@nestjs/jwt";
import {ConfigService} from '@nestjs/config';
import {Request} from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromHeader(request);
        if (!token) throw new UnauthorizedException();

        try {
            request['user'] = await this.jwtService.verify(token, {
                secret: this.configService.get('SECRET_KEY'),
            });
        } catch (e) {
            throw new UnauthorizedException('Invalid token');
        }

        return true;
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const authorization = request.headers['authorization'] || '';
        const [type, token] = authorization.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }

    // Виправлена сигнатура під NestJS 10
    getRequest<T = any>(context: ExecutionContext): T {
        const ctx = context.switchToHttp();
        return ctx.getRequest<T>();
    }
}
