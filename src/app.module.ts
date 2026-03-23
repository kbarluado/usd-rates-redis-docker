import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CurrencyApiModule } from './currency-api/currency-api.module';
import { CurrencyConverterSchedulerModule } from './currency-converter-scheduler/currency-converter-scheduler.module';
import { RedisStoreModule } from './redis-store/redis-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RedisStoreModule,
    CurrencyConverterSchedulerModule,
    CurrencyApiModule,
  ],
})
export class AppModule {}
