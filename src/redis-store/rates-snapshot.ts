export type RatesSnapshot = {
  /** ISO-8601 time of the last successful fetch from ExchangeRate-API */
  lastFetchedAt: string;
  base: string;
  rates: Record<string, number>;
  meta?: {
    time_last_update_utc?: string;
    time_next_update_utc?: string;
    provider?: string;
  };
};
