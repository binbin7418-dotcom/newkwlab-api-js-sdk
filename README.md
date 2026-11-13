# @newkwlab/api-bundle — JavaScript SDK

One API key and one credit balance for the NewKwLab tool suite: email, phone
and card validation, VAT and LEI lookups, sanctions screening, nonprofit and
recall checks, airport data and more — all behind a single gateway.

- **One key** for every connected product (`nkw_live_...`)
- **Credits, not per-API subscriptions** — buy a pack once, spend across tools
- **Not-found results are free** — lookups that come back "no record" cost 0 credits
- **Repeat calls are free for 24h** — same key + same parameters hit the cache, 0 credits
- **Upstream errors are free** — if we fail, you don't pay

## Install

```bash
npm install @newkwlab/api-bundle
```

(Requires Node.js 18+. Zero dependencies.)

> Status: pre-release. Until the npm package is published, use the SDK by
> copying `src/index.mjs` into your project — it is a single self-contained file.

## Quick start

```js
import { NewKwLabClient } from "@newkwlab/api-bundle";

const client = new NewKwLabClient({ apiKey: process.env.NKW_API_KEY });

const { data, creditsCharged, creditsBalance } = await client.emailCheck("alice@gmail.com");
console.log(data.verdict, data.score);      // "valid", 100
console.log(creditsCharged, creditsBalance); // 1, 29999
```

## Getting a key

Keys are issued by activating a license purchased on Gumroad:

```js
import { NewKwLabClient } from "@newkwlab/api-bundle";

const client = new NewKwLabClient();
const result = await client.activate("XXXX-XXXX-XXXX-XXXX", "newkwlab-credits-30000");
console.log(result.granted_credits); // 30000
console.log(result.api_key);         // nkw_live_... — shown ONCE, store it now
```

Activating the same license again is safe (no double credit) and returns
`key_already_issued: true` instead of a new key.

## API

| Method | Description |
|---|---|
| `health()` | Gateway health check. No key required. |
| `activate(licenseKey, productPermalink)` | Activate a Gumroad license → credits (+ first API key, once). |
| `usage()` | Balance, credit lots (source / remaining / expiry), per-product usage. |
| `usageHistory({ days, limit, offset })` | Ledger history. |
| `createKey(label?)` | Issue an additional API key (returned once). |
| `disableKey(keyId)` | Disable one of your keys. |
| `call(product, endpoint, options?)` | Call any connected product. Returns `{ data, creditsCharged, creditsBalance, cache }`. |
| `emailCheck(email)` | EmailCheck shortcut (1 credit). |
| `phoneCheck(phone)` | PhoneCheck shortcut (1 credit). |
| `cardCheck(number)` | CardCheck shortcut (1 credit). |

`call()` options: `{ method = "GET", params = {}, body }`. Endpoint paths are
passed through to the product, e.g.:

```js
await client.call("airportbase", "/airport", { params: { code: "LAX" } }); // 2 credits
await client.call("leilookup", "/lei/5493006MFDD84DZ89524");               // 2 credits, 0 if no record
await client.call("vatscope", "/vat", { params: { country: "DE", vat: "123456789" } });
```

### Connected products (batch 1)

| Product | Credits | Example endpoint |
|---|---|---|
| emailcheck | 1 | `/validate?email=` |
| phonecheck | 1 | `/validate?phone=` |
| cardcheck | 1 | `/validate?number=` |
| vatscope | 2 | `/vat?country=&vat=` |
| leilookup | 2 | `/lei/{lei}`, `/search?name=` |
| nonprofitcheck | 2 | `/org?ein=`, `/search?q=` |
| sanctionscreen | 2 | see product docs |
| censusaddress | 2 | see product docs |
| recallradar | 2 | see product docs |
| airportbase | 2 | `/airport?code=`, `/search?q=` |

Batch endpoints exist per product (e.g. `/validate/batch`) and are charged per
successful row. More products (GeoIP, VIN, IBAN, SEO score, domain trust,
flight status) are priced and join the same key as they pass the connection gate.

## Errors

Gateway errors throw `GatewayError` with `.status` and `.code`:

```js
import { GatewayError } from "@newkwlab/api-bundle";

try {
  await client.emailCheck("a@b.com");
} catch (e) {
  if (e instanceof GatewayError && e.code === "INSUFFICIENT_CREDITS") {
    // top up: buy another credit pack and activate it with the same account flow
  }
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or unknown API key |
| `INSUFFICIENT_CREDITS` | 402 | Balance below the product's credit price — nothing was called or charged |
| `UPGRADE_REQUIRED` | 402 | Account canceled and out of credits |
| `CAPABILITY_DENIED` | 403 | Your plan does not include this product or capability (`missing` lists what is needed) |
| `PRODUCT_NOT_FOUND` | 404 | Unknown product id |
| `PRODUCT_NOT_CONNECTED` | 503 | Product is priced but not yet connected to the gateway |
| `RATE_LIMITED` | 429 | Per-key minute limit for your plan reached |
| `UPSTREAM_ERROR` | 502 | The product's upstream failed — not charged |
| `LICENSE_INVALID` | 404 | (activate) License key not found for that product |
| `LICENSE_REFUNDED` | 409 | (activate) License was refunded or the subscription ended |

## Configuration

| Option / env var | Default |
|---|---|
| `apiKey` / `NKW_API_KEY` | — |
| `baseUrl` / `NKW_BASE_URL` | `https://api.newkwlab.com/gateway` |

## License

MIT
