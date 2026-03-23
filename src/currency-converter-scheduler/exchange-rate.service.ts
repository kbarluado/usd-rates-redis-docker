import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisRatesStore } from '../redis-store/redis-rates.store';
import type { RatesSnapshot } from '../redis-store/rates-snapshot';

type ExchangeRateApiSuccess = {
  result: 'success';
  provider?: string;
  documentation?: string;
  terms_of_use?: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  base_code: string;
  /** Open / some endpoints */
  rates?: Record<string, number>;
  /** v6 keyed API uses this name */
  conversion_rates?: Record<string, number>;
};

@Injectable()
export class ExchangeRateService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly store: RedisRatesStore,
  ) {}

  /**
   * Runs before the HTTP server listens: blocks boot until initial fetch attempts finish
   * (so a new Docker container populates Redis once at startup when the API is reachable).
   */
  async onModuleInit(): Promise<void> {
    await this.tryRefreshFromApi('docker-startup', {
      retries: 5,
      retryDelayMs: 2500,
    });
  }

  /**
   * Fetches from ExchangeRate-API; on failure leaves the previous Redis snapshot unchanged.
   * Use `retries` for transient network blips (e.g. first seconds after `docker compose up`).
   */
  async tryRefreshFromApi(
    reason: string,
    options?: { retries?: number; retryDelayMs?: number },
  ): Promise<void> {
    const maxAttempts = options?.retries ?? 1;
    const delayMs = options?.retryDelayMs ?? 2000;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const snapshot = await this.pullFromApi();
        await this.store.saveSnapshot(snapshot);
        this.logger.log(
          `Rates saved to Redis (${reason}, attempt ${attempt}/${maxAttempts}, lastFetchedAt=${snapshot.lastFetchedAt})`,
        );
        return;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Fetch failed (${reason}) attempt ${attempt}/${maxAttempts}: ${msg}`,
        );
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    const prev = await this.store.getSnapshot();
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    if (prev) {
      this.logger.warn(
        `Fetch failed (${reason}) after ${maxAttempts} attempts: ${msg} — serving previous snapshot from ${prev.lastFetchedAt}`,
      );
    } else {
      this.logger.warn(
        `Fetch failed (${reason}) after ${maxAttempts} attempts: ${msg} — no previous snapshot in Redis yet`,
      );
    }
  }

  private async pullFromApi(): Promise<RatesSnapshot> {
    const url = this.buildUrl();
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const body = (await res.json()) as ExchangeRateApiSuccess | { result: string };
    if (body.result !== 'success') {
      throw new Error(`API error: ${JSON.stringify(body)}`);
    }
    const b = body as ExchangeRateApiSuccess;
    const rates = b.rates ?? b.conversion_rates;
    if (!rates || typeof rates !== 'object') {
      throw new Error(
        `API error: missing rates/conversion_rates: ${JSON.stringify(body).slice(0, 500)}`,
      );
    }
    const lastFetchedAt = new Date().toISOString();
    return {
      lastFetchedAt,
      base: b.base_code,
      rates,
      meta: {
        time_last_update_utc: b.time_last_update_utc,
        time_next_update_utc: b.time_next_update_utc,
        provider: b.provider,
      },
    };
  }

  private buildUrl(): string {
    const key = this.config.get<string>('EXCHANGE_RATE_API_KEY')?.trim();
    if (key) {
      return `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/USD`;
    }
    return 'https://open.er-api.com/v6/latest/USD';
  }
}
