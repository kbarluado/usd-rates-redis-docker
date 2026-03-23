import { Module } from '@nestjs/common';
import { CurrencyConverterSchedulerModule } from '../currency-converter-scheduler/currency-converter-scheduler.module';
import { ApiKeyGuard } from './api-key.guard';
import { RatesController } from './rates.controller';

@Module({
  imports: [CurrencyConverterSchedulerModule],
  controllers: [RatesController],
  providers: [ApiKeyGuard],
})
export class CurrencyApiModule {}
