import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Every route requires a valid access token by default (global JwtAuthGuard).
 * Mark a route or controller as public only with a comment explaining why.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
