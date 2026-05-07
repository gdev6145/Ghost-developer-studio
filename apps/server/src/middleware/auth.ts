import type { Socket } from 'socket.io'
import { verifyToken } from '@ghost/auth'
import { extractBearerToken } from '@ghost/auth'

/**
 * Socket.IO authentication middleware.
 * Validates JWT from handshake auth or Authorization header.
 * Attaches decoded userId to socket.data.
 */
export function authMiddleware(jwtSecret: string) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    try {
      const token =
        (socket.handshake.auth['token'] as string | undefined) ??
        extractBearerToken(socket.handshake.headers['authorization'])

      if (!token) {
        return next(new Error('Authentication required'))
      }

      const payload = verifyToken(token, jwtSecret)
      socket.data['userId'] = payload.sub
      socket.data['email'] = payload.email
      socket.data['username'] = payload.username
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  }
}
