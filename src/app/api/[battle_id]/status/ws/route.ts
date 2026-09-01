import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';


// app/api/ws/route.ts
export const GET = () => {
  return NextResponse.next();
};

// prévu plus tard
export async function UPGRADE(
  client: import('ws').WebSocket,
  server: import('ws').WebSocketServer,
  request: NextRequest
) {
  logger.info('A client connected');

  client.on("message", (msg) => {
    try {
        const d = JSON.parse(msg.toString());
        if (d.type === "ping") {
            client.send(JSON.stringify({ type: "pong" }));
        }
    } catch {}
});
}