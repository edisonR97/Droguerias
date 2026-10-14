import type { SessionUser } from '@farmacore/shared';
export interface RequestUser extends SessionUser {
  sessionId: string;
}
export interface JwtPayload {
  sub: string;
  establishmentId: string;
  sessionId: string;
  type: 'access' | 'refresh';
}
