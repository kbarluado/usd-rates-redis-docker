import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExchangeRateService } from './exchange-rate.service';

@Injectable()
export class ExchangeRateScheduler {
  private readonly logger = new Logger(ExchangeRateScheduler.name);

  constructor(private readonly rates: ExchangeRateService) {}

  @Cron('0 8 * * *', { name: 'usd-rates-morning' })
  morning(): void {
    this.logger.log('Cron: morning fetch');
    void this.rates.tryRefreshFromApi('morning');
  }

  @Cron('0 14 * * *', { name: 'usd-rates-afternoon' })
  afternoon(): void {
    this.logger.log('Cron: afternoon fetch');
    void this.rates.tryRefreshFromApi('afternoon');
  }

  @Cron('0 20 * * *', { name: 'usd-rates-evening' })
  evening(): void {
    this.logger.log('Cron: evening fetch');
    void this.rates.tryRefreshFromApi('evening');
  }
}
