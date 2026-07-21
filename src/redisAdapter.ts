import { Redis as UpstashRedis } from '@upstash/redis';
import IoRedis from 'ioredis';

export interface RedisAdapter {
  sadd(key: string, ...members: unknown[]): Promise<number>;
  eval<TData = unknown>(script: string, keys: string[], args: unknown[]): Promise<TData>;
  lpush(key: string, ...elements: string[]): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<string>;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<string | null>;
  publish(channel: string, message: string): Promise<number>;
  xadd(key: string, id: string, args: Record<string, string>): Promise<string>;
  xrange(key: string, start: string, end: string): Promise<any>;
}

export class UpstashRedisAdapter implements RedisAdapter {
  constructor(public client: UpstashRedis) {}

  async sadd(key: string, ...members: unknown[]): Promise<number> {
    return (this.client as any).sadd(key, ...members);
  }
  async eval<TData = unknown>(script: string, keys: string[], args: unknown[]): Promise<TData> {
    return (this.client as any).eval(script, keys, args);
  }
  async lpush(key: string, ...elements: string[]): Promise<number> {
    return (this.client as any).lpush(key, ...elements);
  }
  async ltrim(key: string, start: number, stop: number): Promise<string> {
    return (this.client as any).ltrim(key, start, stop);
  }
  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }
  async set(key: string, value: unknown): Promise<string | null> {
    return (this.client as any).set(key, value) as Promise<string | null>;
  }
  async publish(channel: string, message: string): Promise<number> {
    return (this.client as any).publish(channel, message);
  }
  async xadd(key: string, id: string, args: Record<string, string>): Promise<string> {
    const arr = Object.entries(args).flat();
    return (this.client as any).xadd(key, id, ...arr);
  }
  async xrange(key: string, start: string, end: string): Promise<any> {
    return (this.client as any).xrange(key, start, end);
  }
}

export class NativeRedisAdapter implements RedisAdapter {
  constructor(public client: IoRedis) {}

  async sadd(key: string, ...members: unknown[]): Promise<number> {
    return (this.client as any).sadd(key, ...(members as string[]));
  }
  async eval<TData = unknown>(script: string, keys: string[], args: unknown[]): Promise<TData> {
    return (this.client as any).eval(script, keys.length, ...keys, ...(args as any[])) as Promise<TData>;
  }
  async lpush(key: string, ...elements: string[]): Promise<number> {
    return (this.client as any).lpush(key, ...elements);
  }
  async ltrim(key: string, start: number, stop: number): Promise<string> {
    return (this.client as any).ltrim(key, start, stop) as any;
  }
  async get<T>(key: string): Promise<T | null> {
    const val = await (this.client as any).get(key);
    if (val === null || val === undefined) return null;
    try {
      return JSON.parse(String(val)) as T;
    } catch {
      return String(val) as any;
    }
  }
  async set(key: string, value: unknown): Promise<string | null> {
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    return (this.client as any).set(key, val) as any;
  }
  async publish(channel: string, message: string): Promise<number> {
    return (this.client as any).publish(channel, message);
  }
  async xadd(key: string, id: string, args: Record<string, string>): Promise<string> {
    const arr = Object.entries(args).flat();
    return (this.client as any).xadd(key, id, ...arr);
  }
  async xrange(key: string, start: string, end: string): Promise<any> {
    return (this.client as any).xrange(key, start, end);
  }
}

export function createRedisAdapter(redisUrl: string | undefined, upstashUrl: string | undefined, upstashToken: string | undefined): { adapter: RedisAdapter | null, provider: 'native' | 'upstash-redis' | 'disabled' } {
  if (redisUrl) {
    return {
      adapter: new NativeRedisAdapter(new IoRedis(redisUrl)),
      provider: 'native'
    };
  }
  if (upstashUrl && upstashToken) {
    return {
      adapter: new UpstashRedisAdapter(new UpstashRedis({ url: upstashUrl, token: upstashToken })),
      provider: 'upstash-redis'
    };
  }
  return { adapter: null, provider: 'disabled' };
}
