# Currency converter (NestJS + Redis + Docker Compose)

Caches **USD → all supported currencies** from [ExchangeRate-API](https://www.exchangerate-api.com/) in **Redis**. If a scheduled or startup fetch fails, **the previous snapshot stays in Redis** and the API keeps serving it until a fetch succeeds.

No GitHub Actions — run everything with Compose or locally.

## Quick start

You **must** have a `.env` file (Compose will not build or start the app without it).

```bash
cp .env.example .env
docker compose up --build -d
```

- API: **http://localhost:3000** (or whatever you set as `PORT` in `.env`)
- On **container start**, the app **does not listen for HTTP** until it has finished an **initial fetch sequence** (5 attempts, 2.5s apart, 20s timeout per HTTP call). That way a new container **tries hard once** to seed Redis when outbound HTTPS to the rates API works.
- Redis: **localhost:6380** on your machine (maps to 6379 inside the container). Compose overrides `REDIS_URL` for the `app` container to `redis://redis:6379`.
- **CORS** is enabled (`origin: true`) so local SPAs (e.g. on port 8080) can call the API from the browser.

### Static API key

Set `API_STATIC_KEY` in `.env` (the example uses `dev-static-token`). Use either header:

- `X-Api-Key: dev-static-token`
- `Authorization: Bearer dev-static-token`

Example (see [API](#api) for all endpoints):

```bash
curl -s -H "X-Api-Key: dev-static-token" http://localhost:3000/rates
```

If Redis is still empty (e.g. startup fetch failed), **`GET /rates`** and **`GET /currencies`** each trigger a fetch before responding.

## API

All endpoints require the same auth:

| Header | Value |
|--------|--------|
| `X-Api-Key` | Your `API_STATIC_KEY` |
| or `Authorization` | `Bearer <API_STATIC_KEY>` |

Base URL: `http://localhost:<PORT>` (default port **3000**).

### `GET /rates`

Full cached snapshot from Redis (USD base, all pairs, provider metadata).

**Response** `200` — JSON:

| Field | Type | Description |
|-------|------|-------------|
| `lastFetchedAt` | string | ISO-8601 time of last successful save |
| `base` | string | Base currency code (e.g. `USD`) |
| `rates` | object | Map of currency code → multiplier vs base |
| `meta` | object | Optional: `time_last_update_utc`, `time_next_update_utc`, `provider` |

```json
{
  "lastFetchedAt": "2026-03-24T12:00:00.000Z",
  "base": "USD",
  "rates": { "EUR": 0.92, "GBP": 0.79 },
  "meta": {
    "time_last_update_utc": "Mon, 24 Mar 2026 00:00:01 +0000",
    "provider": "https://www.exchangerate-api.com"
  }
}
```

```bash
curl -s -H "X-Api-Key: YOUR_KEY" "http://localhost:3000/rates"
```

### `GET /currencies`

Same data as `/rates`, shaped for listing or key–value use. **404** if Redis is empty and on-demand fetch fails.

#### Default: array of `{ code, rate }`

Sorted alphabetically by `code`.

```bash
curl -s -H "X-Api-Key: YOUR_KEY" "http://localhost:3000/currencies"
```

```json
{
  "lastFetchedAt": "2026-03-24T12:00:00.000Z",
  "base": "USD",
  "currencies": [
    { "code": "AED", "rate": 3.6725 },
    { "code": "EUR", "rate": 0.8651 }
  ]
}
```

#### Query `format=map` or `format=object`

Returns a **`rates`** object keyed by ISO currency code (same shape as inside `/rates`).

```bash
curl -s -H "X-Api-Key: YOUR_KEY" "http://localhost:3000/currencies?format=map"
```

```json
{
  "lastFetchedAt": "2026-03-24T12:00:00.000Z",
  "base": "USD",
  "rates": {
    "USD": 1,
    "AED": 3.6725,
    "EUR": 0.8651
  }
}
```

## Local development (no Docker image)

Use **Node.js 24+** (matches the Docker image).

```bash
cp .env.example .env
docker compose up -d redis   # or run your own Redis on REDIS_URL
npm install
npm run start:dev
```

Cron runs at **08:00, 14:00, and 20:00** in the **process timezone** (set `TZ=UTC` if you want UTC). The app also triggers **one fetch on startup**.

## Configuration

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default **3000**) |
| `REDIS_URL` | In Compose the app uses `redis://redis:6379`. From your host (Nest on the machine, Redis in Compose) use `redis://localhost:6380` |
| `API_STATIC_KEY` | Required in `.env` for Docker Compose; secret for `/rates` and `/currencies` |
| `EXCHANGE_RATE_API_KEY` | Optional ExchangeRate-API key; if empty, the [open endpoint](https://www.exchangerate-api.com/docs/free) is used |

## Layout

- `src/currency-converter-scheduler/` — fetch + cron + “keep previous on error”
- `src/currency-api/` — `GET /rates`, `GET /currencies` + API key guard
- `src/redis-store/` — Redis read/write for the snapshot
