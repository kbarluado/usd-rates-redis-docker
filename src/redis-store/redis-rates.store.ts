import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RatesSnapshot } from './rates-snapshot';

const REDIS_KEY = 'currency:usd_rates_snapshot';

@Injectable()
export class RedisRatesStore implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6380';
    this.redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async getSnapshot(): Promise<RatesSnapshot | null> {
    const raw = await this.redis.get(REDIS_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as RatesSnapshot;
    } catch {
      return null;
    }
  }

  /** Only call after a successful upstream fetch. Failed fetches must not call this. */
  async saveSnapshot(snapshot: RatesSnapshot): Promise<void> {
    await this.redis.set(REDIS_KEY, JSON.stringify(snapshot));
  }
}
