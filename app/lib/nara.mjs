// These aliases are advertised with zero token prices, not merely included in a paid plan.
// Never accept auto routers, user-defined aliases, or a configurable inference host here.
export const NARA_BASE = "https://router.bynara.id/v1";
export const NARA_PLANS = "https://router.bynara.id/api/plans";
export const NARA_FREE_MODELS = Object.freeze(["nemotron-3.5-lightning-free", "nemotron-3-ultra-free"]);
export const NARA_DEFAULT_MODEL = NARA_FREE_MODELS[0];

export function checkAllowedModel(model) {
  if (!NARA_FREE_MODELS.includes(model)) throw new Error("NaraRouter free-only mode blocks this model. Use nemotron-3.5-lightning-free or nemotron-3-ultra-free; auto routing is disabled.");
}

export function checkFreePlan(model, catalog) {
  checkAllowedModel(model);
  const plan = catalog?.data?.find(p => p.code === "free");
  if (!plan || plan.is_active !== true || plan.price_daily_idr !== 0 || plan.price_weekly_idr !== 0 || !Array.isArray(plan.models) || !plan.models.includes(model)) {
    throw new Error("NaraRouter no longer confirms this model in its active zero-price Free plan. Request blocked; no paid fallback.");
  }
}

export async function assertFreeModel(model) {
  // Check the local allowlist before making any network request.
  checkAllowedModel(model);
  let response;
  try {
    response = await fetch(NARA_PLANS, { signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error" });
  } catch { throw new Error("Cannot verify NaraRouter's current Free plan. Request blocked; no paid fallback."); }
  if (!response.ok) throw new Error("Cannot verify NaraRouter's current Free plan. Request blocked; no paid fallback.");
  let catalog;
  try { catalog = await response.json(); } catch { throw new Error("Invalid NaraRouter plan catalog. Request blocked; no paid fallback."); }
  checkFreePlan(model, catalog);
}

// Serialize request starts to stay below the Free plan's 15 requests/minute.
let queue = Promise.resolve();
let lastStart = 0;
export function reserveFreeSlot() {
  const slot = queue.then(async () => {
    const delay = Math.max(0, lastStart + 4100 - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastStart = Date.now();
  });
  queue = slot.catch(() => {});
  return slot;
}
