import { Global, Module } from '@nestjs/common';
import { RedisRatesStore } from './redis-rates.store';

@Global()
@Module({
  providers: [RedisRatesStore],
  exports: [RedisRatesStore],
})
export class RedisStoreModule {}
