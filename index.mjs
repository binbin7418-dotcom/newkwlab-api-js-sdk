// NewKwLab API Bundle — JavaScript SDK
//
// Wraps the production gateway at https://api.newkwlab.com/gateway:
//   POST /v1/activate            activate a Gumroad license key -> credits + first API key
//   GET  /v1/usage               balance, credit lots, per-product usage (Bearer key)
//   GET  /v1/usage/history       ledger history (Bearer key)
//   POST /v1/keys                issue an additional API key (Bearer key)
//   DELETE /v1/keys/:id          disable an API key (Bearer key)
//   GET|POST /v1/<product>/<endpoint>   product call, charged per result in credits
//
// Product calls return credit headers: x-credits-charged, x-credits-balance,
// x-cache (HIT = same key + same parameters within 24h, charged 0 credits).
// "Not found" results and upstream errors are never charged.

export const DEFAULT_BASE_URL = "https://api.newkwlab.com/gateway";

export class GatewayError extends Error {
  constructor(status, code, detail) {
    super(`Gateway error ${status}: ${code}${detail ? ` — ${detail}` : ""}`);
    this.name = "GatewayError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export class NewKwLabClient {
  /**
   * @param {object} [options]
   * @param {string} [options.apiKey]   Aggregate API key (nkw_live_...). Not needed for health()/activate().
   * @param {string} [options.baseUrl]  Gateway base URL. Defaults to the production gateway.
   * @param {Function} [options.fetch]  fetch implementation (defaults to global fetch, Node >= 18).
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.NKW_API_KEY ?? null;
    this.baseUrl = (options.baseUrl ?? process.env.NKW_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this._fetch = options.fetch ?? globalThis.fetch;
    if (typeof this._fetch !== "function") {
      throw new Error("No fetch implementation available — use Node >= 18 or pass options.fetch.");
    }
  }

  async _request(method, path, { body, auth = true } = {}) {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (auth) {
      if (!this.apiKey) {
        throw new Error("An API key is required for this call — pass { apiKey } or set NKW_API_KEY.");
      }
      headers["authorization"] = `Bearer ${this.apiKey}`;
    }
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { res, data };
  }

  _unwrap({ res, data }) {
    if (!res.ok) {
      const err = (data && typeof data === "object" && data.error) || {};
      throw new GatewayError(res.status, err.code ?? "UNKNOWN_ERROR", err.detail ?? err.reason);
    }
    return data;
  }

  /** GET /health — no key required. Returns { ok: true }. */
  async health() {
    return this._unwrap(await this._request("GET", "/health", { auth: false }));
  }

  /**
   * POST /v1/activate — exchange a Gumroad license key for credits.
   * On first activation the response includes `api_key` (plaintext, shown once);
   * store it. Repeat activation returns `key_already_issued: true` instead.
   */
  async activate(licenseKey, productPermalink) {
    return this._unwrap(await this._request("POST", "/v1/activate", {
      auth: false,
      body: { license_key: licenseKey, product_permalink: productPermalink },
    }));
  }

  /** GET /v1/usage — balance, credit lots (source / remaining / expires_at), per-product usage. */
  async usage() {
    return this._unwrap(await this._request("GET", "/v1/usage"));
  }

  /** GET /v1/usage/history — ledger entries for the last `days` days (1–90). */
  async usageHistory({ days = 30, limit = 50, offset = 0 } = {}) {
    const q = new URLSearchParams({ days: String(days), limit: String(limit), offset: String(offset) });
    return this._unwrap(await this._request("GET", `/v1/usage/history?${q}`));
  }

  /** POST /v1/keys — issue an additional API key. The plaintext key is returned once. */
  async createKey(label) {
    return this._unwrap(await this._request("POST", "/v1/keys", { body: label ? { label } : {} }));
  }

  /** DELETE /v1/keys/:id — disable one of your API keys. */
  async disableKey(keyId) {
    return this._unwrap(await this._request("DELETE", `/v1/keys/${encodeURIComponent(keyId)}`));
  }

  /**
   * Call any connected product: /v1/<product>/<endpoint>.
   * @param {string} product   e.g. "emailcheck", "vatscope", "leilookup"
   * @param {string} endpoint  e.g. "/validate" (leading slash optional)
   * @param {object} [options] { method = "GET", params = {}, body }
   * Resolves to { data, creditsCharged, creditsBalance, cache }.
   * On gateway errors, throws GatewayError with .status and .code
   * (401 UNAUTHORIZED, 402 INSUFFICIENT_CREDITS, 403 CAPABILITY_DENIED,
   * 503 PRODUCT_NOT_CONNECTED, ...).
   */
  async call(product, endpoint, { method = "GET", params = {}, body } = {}) {
    const ep = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const q = new URLSearchParams(params).toString();
    const path = `/v1/${product}${ep}${q ? `?${q}` : ""}`;
    const { res, data } = await this._request(method, path, { body });
    if (!res.ok) {
      const err = (data && typeof data === "object" && data.error) || {};
      throw new GatewayError(res.status, err.code ?? "UNKNOWN_ERROR", err.detail ?? err.reason);
    }
    return {
      data,
      creditsCharged: res.headers.get("x-credits-charged") !== null ? Number(res.headers.get("x-credits-charged")) : null,
      creditsBalance: res.headers.get("x-credits-balance") !== null ? Number(res.headers.get("x-credits-balance")) : null,
      cache: res.headers.get("x-cache"),
    };
  }

  // ---- Convenience wrappers for the anchor products ----

  /** EmailCheck (1 credit): full validation verdict for one email address. */
  async emailCheck(email) {
    return this.call("emailcheck", "/validate", { params: { email } });
  }

  /** PhoneCheck (1 credit): validity and line details for one phone number. */
  async phoneCheck(phone) {
    return this.call("phonecheck", "/validate", { params: { phone } });
  }

  /** CardCheck (1 credit): BIN / Luhn / brand checks for one card number. */
  async cardCheck(number) {
    return this.call("cardcheck", "/validate", { params: { number } });
  }
}

export default NewKwLabClient;
