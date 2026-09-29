import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Container } from '../container.js';
import { createApp, type AppOptions } from '../http/app.js';

export interface TestServer {
  base: string;
  /** Closes open SSE connections too, so it never hangs. */
  close(): Promise<void>;
}

export async function startServer(container: Container, options: AppOptions = {}): Promise<TestServer> {
  const app = createApp(container, options);
  const server = await new Promise<Server>((resolve) => {
    const listening: Server = app.listen(0, () => resolve(listening));
  });
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export interface ApiResponse<T> {
  status: number;
  body: T;
}

/** A tiny JSON client that sends `X-Demo-User` when `user` is given. */
export function apiClient(base: string, user?: string) {
  return async <T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> => {
    const headers: Record<string, string> = {};
    if (user) headers['X-Demo-User'] = user;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
  };
}

export interface SseFrame {
  event: string;
  data: unknown;
}

export interface SseStream {
  status: number;
  headers: Headers;
  /** The next frame that carries data; comments and `retry:` lines are skipped. */
  next(): Promise<SseFrame>;
  close(): void;
}

export async function openStream(url: string, headers: Record<string, string> = {}): Promise<SseStream> {
  const controller = new AbortController();
  const res = await fetch(url, { headers, signal: controller.signal });
  const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  const next = async (): Promise<SseFrame> => {
    if (!reader) throw new Error('response has no body');
    for (;;) {
      const end = buffer.indexOf('\n\n');
      if (end >= 0) {
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of raw.split('\n')) {
          if (line.startsWith('event: ')) event = line.slice('event: '.length);
          else if (line.startsWith('data: ')) data.push(line.slice('data: '.length));
        }
        if (data.length > 0) return { event, data: JSON.parse(data.join('\n')) as unknown };
        continue;
      }
      const { value, done } = await reader.read();
      if (done) throw new Error('stream ended');
      buffer += value;
    }
  };

  return { status: res.status, headers: res.headers, next, close: () => controller.abort() };
}
