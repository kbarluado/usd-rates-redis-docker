import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** Default matches docker-compose / .env.example for zero-config local and Compose runs. */
const DEFAULT_STATIC_KEY = 'dev-static-token';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected =
      this.config.get<string>('API_STATIC_KEY')?.trim() || DEFAULT_STATIC_KEY;
    const req = context.switchToHttp().getRequest<Request>();
    const headerKey = req.headers['x-api-key'];
    const auth = req.headers.authorization;
    let provided: string | undefined;
    const fromHeader =
      typeof headerKey === 'string'
        ? headerKey
        : Array.isArray(headerKey)
          ? headerKey[0]
          : undefined;
    if (fromHeader) {
      provided = fromHeader.trim();
    } else {
      const bearer =
        typeof auth === 'string'
          ? auth
          : Array.isArray(auth)
            ? auth[0]
            : undefined;
      if (bearer?.startsWith('Bearer ')) {
        provided = bearer.slice(7).trim();
      }
    }
    if (provided === expected) {
      return true;
    }
    throw new UnauthorizedException('Invalid or missing API key');
  }
}
