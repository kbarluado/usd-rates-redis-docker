import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExchangeRateService } from '../currency-converter-scheduler/exchange-rate.service';
import type { RatesSnapshot } from '../redis-store/rates-snapshot';
import { RedisRatesStore } from '../redis-store/redis-rates.store';
import { ApiKeyGuard } from './api-key.guard';

@Controller()
@UseGuards(ApiKeyGuard)
export class RatesController {
  constructor(
    private readonly store: RedisRatesStore,
    private readonly exchangeRates: ExchangeRateService,
  ) {}

  /**
   * Full snapshot: base, rates, meta, lastFetchedAt.
   * If Redis is empty, triggers a live fetch first.
   */
  @Get('rates')
  async getRates(): Promise<RatesSnapshot> {
    return this.loadSnapshot();
  }

  /**
   * USD conversion factors only.
   * - Default: `{ lastFetchedAt, base, currencies: [{ code, rate }, ...] }` sorted by code.
   * - `?format=map` (alias `object`): `{ lastFetchedAt, base, rates: { USD: 1, EUR: 0.86, ... } }`.
   */
  @Get('currencies')
  async getCurrencies(
    @Query('format') format?: string,
  ): Promise<
    | {
        lastFetchedAt: string;
        base: string;
        currencies: { code: string; rate: number }[];
      }
    | {
        lastFetchedAt: string;
        base: string;
        rates: Record<string, number>;
      }
  > {
    const snapshot = await this.loadSnapshot();
    const f = format?.toLowerCase();
    if (f === 'map' || f === 'object') {
      return {
        lastFetchedAt: snapshot.lastFetchedAt,
        base: snapshot.base,
        rates: snapshot.rates,
      };
    }
    const currencies = Object.entries(snapshot.rates)
      .map(([code, rate]) => ({ code, rate }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return {
      lastFetchedAt: snapshot.lastFetchedAt,
      base: snapshot.base,
      currencies,
    };
  }

  private async loadSnapshot(): Promise<RatesSnapshot> {
    let snapshot = await this.store.getSnapshot();
    if (!snapshot) {
      await this.exchangeRates.tryRefreshFromApi('get-rates-empty-cache');
      snapshot = await this.store.getSnapshot();
    }
    if (!snapshot) {
      throw new NotFoundException(
        'No rates in Redis yet. The on-demand fetch failed; check logs and EXCHANGE_RATE_API_KEY / network.',
      );
    }
    return snapshot;
  }
}
