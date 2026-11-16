import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Verifies the Bearer token through JwtStrategy; request.user becomes AuthenticatedUser. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
