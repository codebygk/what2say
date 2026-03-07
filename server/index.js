// ─────────────────────────────────────────────
//  ZapComment — License Validation Worker
//  Cloudflare Worker — single file, zero deps
//
//  Routes:
//    POST /validate        → check if a key is valid
//    POST /webhook         → Dodo Payments webhook
//    POST /deactivate      → remove a device from a key
// ─────────────────────────────────────────────

const SEAT_LIMIT        = 2;
const CACHE_TTL_SECONDS = 86400 * 365; // 1 year

export default {
  async fetch(request, env) {
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
      console.error("[ZapComment] Worker error:", err);
      response = json({ error: "Internal server error" }, 500);
    }

    // Attach CORS to every response
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

  const license = await getLicense(env, key.trim().toUpperCase());

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
        error: `Key already active on ${license.seatLimit} device(s). Deactivate one to continue.`,
      });
    }
    license.devices.push(deviceId);
    await saveLicense(env, key.trim().toUpperCase(), license);
  }

  return json({ valid: true, plan: license.plan });
}

// ─────────────────────────────────────────────
//  POST /webhook
//  Called by Dodo Payments
//  Follows Standard Webhooks spec:
//    Headers: webhook-id, webhook-timestamp, webhook-signature
//    Body: { type, data, business_id, timestamp }
// ─────────────────────────────────────────────
async function handleWebhook(request, env) {
  const rawBody = await request.text();

  // Verify Standard Webhooks signature
  const webhookId        = request.headers.get("webhook-id")        ?? "";
  const webhookTimestamp = request.headers.get("webhook-timestamp")  ?? "";
  const webhookSignature = request.headers.get("webhook-signature")  ?? "";

  const isValid = await verifyDodoSignature(
    rawBody, webhookId, webhookTimestamp, webhookSignature,
    env.DODO_WEBHOOK_SECRET
  );

  if (!isValid) {
    console.error("[ZapComment] Webhook signature mismatch");
    return json({ error: "Invalid signature" }, 401);
  }

  const payload   = JSON.parse(rawBody);
  const eventType = payload?.type ?? "";

  console.log("[ZapComment] Webhook received:", eventType);

  if (eventType === "license_key.created") {
    await handleLicenseKeyCreated(payload, env);
  } else if (eventType === "license_key.updated") {
    await handleLicenseKeyUpdated(payload, env);
  } else if (eventType === "payment.succeeded") {
    // payment.succeeded fires before license_key.created
    // Log it but take no action — license comes via license_key.created
    console.log("[ZapComment] payment.succeeded — waiting for license_key.created");
  } else {
    console.log("[ZapComment] Unhandled event:", eventType);
  }

  return json({ received: true });
}

// ─────────────────────────────────────────────
//  Dodo Payments — license_key.created
//  payload.data fields (from docs):
//    key               — the license key string
//    status            — "active" | "expired" | "disabled"
//    activations_limit — max devices (null = unlimited)
//    expires_at        — ISO string or null
//    customer_id       — cus_xxx
//    payment_id        — pay_xxx
//    product_id        — pdt_xxx
// ─────────────────────────────────────────────
async function handleLicenseKeyCreated(payload, env) {
  console.log("[ZapComment] license_key.created payload:", JSON.stringify(payload, null, 2));

  const data = payload?.data;
  const key  = data?.key;

  if (!key) {
    console.error("[ZapComment] No key in license_key.created payload");
    return;
  }

  const seatLimit = data?.activations_limit ?? SEAT_LIMIT;
  const expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : null;

  await saveLicense(env, key.trim().toUpperCase(), {
    customerId: data?.customer_id ?? null,
    paymentId:  data?.payment_id  ?? null,
    productId:  data?.product_id  ?? null,
    plan:       "pro",
    devices:    [],
    seatLimit,
    revoked:    false,
    createdAt:  Date.now(),
    expiresAt,
  });

  console.log("[ZapComment] License saved:", key);
}

// ─────────────────────────────────────────────
//  Dodo Payments — license_key.updated
//  Fired when status changes (e.g., disabled after refund)
// ─────────────────────────────────────────────
async function handleLicenseKeyUpdated(payload, env) {
  console.log("[ZapComment] license_key.updated payload:", JSON.stringify(payload, null, 2));

  const data   = payload?.data;
  const key    = data?.key;
  const status = data?.status; // "active" | "expired" | "disabled"

  if (!key) return;

  const license = await getLicense(env, key.trim().toUpperCase());
  if (!license) return;

  license.revoked   = (status === "disabled" || status === "expired");
  license.expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : license.expiresAt;

  await saveLicense(env, key.trim().toUpperCase(), license);
  console.log("[ZapComment] License updated — key:", key, "status:", status);
}

// ─────────────────────────────────────────────
//  POST /deactivate
//  Body: { key, deviceId }
// ─────────────────────────────────────────────
async function handleDeactivate(request, env) {
  const { key, deviceId } = await request.json();

  if (!key || !deviceId) {
    return json({ ok: false, error: "Missing key or deviceId" }, 400);
  }

  const license = await getLicense(env, key.trim().toUpperCase());
  if (!license) return json({ ok: false, error: "Key not found" });

  license.devices = license.devices.filter((d) => d !== deviceId);
  await saveLicense(env, key.trim().toUpperCase(), license);

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
    expirationTtl: CACHE_TTL_SECONDS,
  });
}

// ─────────────────────────────────────────────
//  Dodo Payments Webhook Signature Verification
//
//  Standard Webhooks spec:
//  signed_content = "{webhook-id}.{webhook-timestamp}.{body}"
//  signature      = base64(HMAC-SHA256(secret, signed_content))
//
//  The webhook-signature header may contain multiple sigs:
//  "v1,BASE64SIG v1,BASE64SIG2"
//  We check if ANY of them match.
// ─────────────────────────────────────────────
async function verifyDodoSignature(body, msgId, msgTimestamp, sigHeader, secret) {
  if (!secret || !sigHeader || !msgId || !msgTimestamp) return false;

  try {
    // Reject if timestamp is too old (5 minute tolerance)
    const ts = parseInt(msgTimestamp, 10);
    if (Math.abs(Date.now() / 1000 - ts) > 300) {
      console.error("[ZapComment] Webhook timestamp too old:", ts);
      return false;
    }

    const signedContent = `${msgId}.${msgTimestamp}.${body}`;

    // Dodo secret is base64-encoded — decode it first
    const secretBytes = base64ToUint8Array(secret.replace(/^whsec_/, ""));

    const cryptoKey = await crypto.subtle.importKey(
      "raw", secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );

    const encoder   = new TextEncoder();
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(signedContent));
    const expected  = uint8ArrayToBase64(new Uint8Array(signature));

    // Header may have multiple signatures: "v1,SIG1 v1,SIG2"
    const sigs = sigHeader.split(" ").map((s) => s.replace(/^v1,/, ""));
    return sigs.some((s) => s === expected);
  } catch (err) {
    console.error("[ZapComment] Signature verification error:", err);
    return false;
  }
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
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