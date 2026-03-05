// ─────────────────────────────────────────────
//  Way2Say — License Validation Worker
//  Cloudflare Worker — single file, zero deps
//
//  Routes:
//    POST /validate        → check if a key is valid
//    POST /webhook         → Lemon Squeezy payment webhook
//    POST /deactivate      → remove a device from a key
// ─────────────────────────────────────────────

const SEAT_LIMIT         = 2;    // devices per key
const CACHE_TTL_SECONDS  = 86400; // 24h KV cache
const LS_WEBHOOK_SECRET  = "LEMON_SQUEEZY_WEBHOOK_SECRET"; // set in wrangler.toml [vars]

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";

    // Handle preflight — Chrome extensions send OPTIONS before POST
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin":  "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age":       "86400",
        },
      });
    }

    const url = new URL(request.url);
    let response;

    try {
      if      (url.pathname === "/validate"   && request.method === "POST") response = await handleValidate(request, env);
      else if (url.pathname === "/webhook"    && request.method === "POST") response = await handleWebhook(request, env);
      else if (url.pathname === "/deactivate" && request.method === "POST") response = await handleDeactivate(request, env);
      else response = json({ error: "Not found" }, 404);
    } catch (err) {
      console.error("Worker error:", err);
      response = json({ error: "Internal server error" }, 500);
    }

    // Attach CORS to every response — must clone since headers may be immutable
    const corsResponse = new Response(response.body, response);
    corsResponse.headers.set("Access-Control-Allow-Origin", "*");
    corsResponse.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    corsResponse.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return corsResponse;
  },
};

// ─────────────────────────────────────────────
//  POST /validate
//  Body: { key, deviceId }
//  Returns: { valid, plan, error? }
// ─────────────────────────────────────────────
async function handleValidate(request, env) {
  const { key, deviceId } = await request.json();

  if (!key || !deviceId) {
    return json({ valid: false, error: "Missing key or deviceId" }, 400);
  }

  const license = await getLicense(env, key);

  if (!license) {
    return json({ valid: false, error: "License key not found." });
  }

  if (license.revoked) {
    return json({ valid: false, error: "This license has been revoked." });
  }

  if (license.expiresAt && Date.now() > license.expiresAt) {
    return json({ valid: false, error: "This license has expired." });
  }

  // Register device if not already registered
  if (!license.devices.includes(deviceId)) {
    if (license.devices.length >= license.seatLimit) {
      return json({
        valid: false,
        error: `This key is already active on ${license.seatLimit} device(s). Deactivate one to continue.`,
      });
    }
    license.devices.push(deviceId);
    await saveLicense(env, key, license);
  }

  return json({ valid: true, plan: license.plan });
}

// ─────────────────────────────────────────────
//  POST /webhook
//  Called by Lemon Squeezy on order_created
//  Verifies signature, creates license in KV
// ─────────────────────────────────────────────
async function handleWebhook(request, env) {
  const rawBody  = await request.text();
  const signature = request.headers.get("X-Signature") ?? "";

  // Verify Lemon Squeezy webhook signature
  const isValid = await verifyWebhookSignature(rawBody, signature, env.LEMON_SQUEEZY_WEBHOOK_SECRET);
  if (!isValid) {
    console.error("Webhook signature mismatch");
    return json({ error: "Invalid signature" }, 401);
  }

  const event = JSON.parse(rawBody);
  const eventName = event?.meta?.event_name;

  // Handle the events we care about
  console.log("[Way2Say] Webhook received:", eventName);

  if      (eventName === "order_created")       await handleOrderCreated(event, env);
  else if (eventName === "license_key_created") await handleLicenseKeyCreated(event, env);
  else if (eventName === "license_key_updated") await handleLicenseUpdated(event, env);
  else    console.log("[Way2Say] Unhandled event:", eventName);

  return json({ received: true });
}

async function handleOrderCreated(event, env) {
  // Log full payload so we can debug field paths in wrangler tail
  console.log("[Way2Say] order_created payload:", JSON.stringify(event, null, 2));

  // Lemon Squeezy payload structure (as of 2024):
  // order_created fires once per order — but does NOT include license keys.
  // License keys come via the separate `license_key_created` event.
  // We handle both here defensively.

  // Path 1: order_created with nested license key (older LS versions)
  let key   = event?.data?.attributes?.license_key?.key
           ?? event?.data?.attributes?.first_order_item?.license_key
           ?? null;
  let email = event?.data?.attributes?.user_email
           ?? event?.data?.attributes?.user?.data?.attributes?.email
           ?? null;
  const planName = event?.data?.attributes?.variant_name
                ?? event?.data?.attributes?.first_order_item?.variant_name
                ?? "pro";

  if (key) {
    await saveLicense(env, key.trim(), {
      email,
      plan:      "pro",
      devices:   [],
      seatLimit: SEAT_LIMIT,
      revoked:   false,
      createdAt: Date.now(),
      expiresAt: null,
    });
    console.log(`[Way2Say] License created (order_created) for ${email}: ${key}`);
  } else {
    console.log("[Way2Say] No license key in order_created — waiting for license_key_created event");
  }
}

// Handles the `license_key_created` event — fires separately from order_created
async function handleLicenseKeyCreated(event, env) {
  console.log("[Way2Say] license_key_created payload:", JSON.stringify(event, null, 2));

  // LS license_key_created payload structure:
  // event.data.attributes.key         — the license key string
  // event.data.attributes.status      — "active" | "inactive" etc
  // event.data.attributes.order_id    — linked order
  // event.meta.custom_data            — any custom data you passed at checkout
  const key   = event?.data?.attributes?.key;
  const email = event?.meta?.custom_data?.email
             ?? event?.data?.attributes?.user_email
             ?? "unknown";

  if (!key) {
    console.error("[Way2Say] No key in license_key_created payload");
    return;
  }

  await saveLicense(env, key.trim(), {
    email,
    plan:      "pro",
    devices:   [],
    seatLimit: SEAT_LIMIT,
    revoked:   false,
    createdAt: Date.now(),
    expiresAt: null,
  });

  console.log(`[Way2Say] License inserted (license_key_created): ${key}`);
}

async function handleLicenseUpdated(event, env) {
  const key    = event?.data?.attributes?.key;
  const status = event?.data?.attributes?.status;

  if (!key) return;

  const license = await getLicense(env, key);
  if (!license) return;

  // Lemon Squeezy statuses: active, inactive, expired, disabled
  license.revoked = (status === "disabled" || status === "inactive");
  await saveLicense(env, key, license);
  console.log(`License ${key} updated to status: ${status}`);
}

// ─────────────────────────────────────────────
//  POST /deactivate
//  Body: { key, deviceId }
//  Removes device from key so it can be used elsewhere
// ─────────────────────────────────────────────
async function handleDeactivate(request, env) {
  const { key, deviceId } = await request.json();

  if (!key || !deviceId) {
    return json({ ok: false, error: "Missing key or deviceId" }, 400);
  }

  const license = await getLicense(env, key);
  if (!license) return json({ ok: false, error: "Key not found" });

  license.devices = license.devices.filter((d) => d !== deviceId);
  await saveLicense(env, key, license);

  return json({ ok: true });
}

// ─────────────────────────────────────────────
//  KV Helpers
// ─────────────────────────────────────────────

async function getLicense(env, key) {
  const raw = await env.LICENSES.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

async function saveLicense(env, key, data) {
  await env.LICENSES.put(key, JSON.stringify(data), {
    expirationTtl: CACHE_TTL_SECONDS * 365, // 1 year
  });
}

// ─────────────────────────────────────────────
//  Webhook Signature Verification
//  Lemon Squeezy uses HMAC-SHA256
// ─────────────────────────────────────────────
async function verifyWebhookSignature(body, signature, secret) {
  if (!secret || !signature) return false;
  try {
    const encoder   = new TextEncoder();
    const keyData   = encoder.encode(secret);
    const msgData   = encoder.encode(body);
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData,
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );
    const signedBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const expectedHex  = Array.from(new Uint8Array(signedBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expectedHex === signature;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
//  Response helper
// ─────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}