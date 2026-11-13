// Manual live test for the JS SDK (not part of the package).
// Usage:
//   node test-live.mjs                      -> health against the production gateway
//   NKW_BASE_URL=http://127.0.0.1:8899 NKW_API_KEY=nkw_live_... node test-live.mjs
// When NKW_API_KEY is set, also runs usage + one CardCheck call (1 credit,
// second identical call must come back as a 0-credit cache HIT).
import { NewKwLabClient, GatewayError } from "./src/index.mjs";

const client = new NewKwLabClient();
console.log("baseUrl:", client.baseUrl);
console.log("health:", await client.health());

if (process.env.NKW_API_KEY) {
  const usage = await client.usage();
  console.log("usage.balance:", usage.balance, "plan:", usage.plan_id);

  const r1 = await client.cardCheck("4242424242424242");
  console.log("cardcheck #1:", r1.data.network, "valid:", r1.data.valid,
    "| charged:", r1.creditsCharged, "balance:", r1.creditsBalance, "cache:", r1.cache);

  const r2 = await client.cardCheck("4242424242424242");
  console.log("cardcheck #2:", "| charged:", r2.creditsCharged, "cache:", r2.cache);

  try {
    const bad = new NewKwLabClient({ apiKey: "nkw_live_forged000000000000000000000000000000" });
    await bad.usage();
    console.log("ERROR: forged key was accepted");
    process.exit(1);
  } catch (e) {
    console.log("forged key rejected:", e instanceof GatewayError, e.status, e.code);
  }
}
console.log("SDK TEST DONE");
