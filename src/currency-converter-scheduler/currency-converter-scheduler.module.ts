import { Module } from '@nestjs/common';
import { ExchangeRateScheduler } from './exchange-rate.scheduler';
import { ExchangeRateService } from './exchange-rate.service';

@Module({
  providers: [ExchangeRateService, ExchangeRateScheduler],
  exports: [ExchangeRateService],
})
export class CurrencyConverterSchedulerModule {}
