/**
 * MedGuard Care — notifications (email + SMS)
 * ------------------------------------------------------------------
 * Sends transactional messages to customers:
 *   - Welcome message when a new account is created.
 *   - Order confirmation when an order/booking is placed.
 *
 * Providers are chosen from environment variables. If none are
 * configured the module safely no-ops (status NOT_CONFIGURED) so the
 * app keeps working with zero setup. To go live, set the env vars
 * below in Render (see .env.example):
 *
 *   Email (SendGrid):  SENDGRID_API_KEY, EMAIL_FROM
 *   SMS   (Twilio):    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *   Or generic webhook: EMAIL_WEBHOOK_URL / SMS_WEBHOOK_URL
 *
 * Dispatch runs in the background so the HTTP response is never blocked.
 */

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "").toLowerCase();
const SMS_PROVIDER = (process.env.SMS_PROVIDER || "").toLowerCase();
const EMAIL_WEBHOOK_URL = process.env.EMAIL_WEBHOOK_URL || "";
const SMS_WEBHOOK_URL = process.env.SMS_WEBHOOK_URL || "";
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "MedGuard Care";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || "";
const NOTIFY_TIMEOUT_MS = Number(process.env.NOTIFY_TIMEOUT_MS || 8000);
const WEBSITE_URL = process.env.WEBSITE_URL || "";

/* ---------- provider resolution ---------- */

function getProvider(channel) {
  const explicit = (channel === "email" ? EMAIL_PROVIDER : SMS_PROVIDER) || "";
  if (explicit) return explicit;
  if (channel === "email") {
    if (SENDGRID_API_KEY && EMAIL_FROM) return "sendgrid";
    if (EMAIL_WEBHOOK_URL) return "webhook";
    return "none";
  }
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) return "twilio";
  if (SMS_WEBHOOK_URL) return "webhook";
  return "none";
}

function isConfigured(channel, provider) {
  if (provider === "sendgrid") return Boolean(SENDGRID_API_KEY && EMAIL_FROM);
  if (provider === "twilio") return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
  if (provider === "webhook") return Boolean(channel === "email" ? EMAIL_WEBHOOK_URL : SMS_WEBHOOK_URL);
  return false;
}

/** True when at least one channel is ready to send. */
function anyChannelReady() {
  return (
    isConfigured("email", getProvider("email")) ||
    isConfigured("sms", getProvider("sms"))
  );
}

/* ---------- transport ---------- */

async function sendViaSendGrid(recipient, payload) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SENDGRID_API_KEY}` },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
      subject: payload.subject || "MedGuard Care",
      content: [{ type: "text/plain", value: payload.message }],
    }),
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`SendGrid HTTP ${res.status}`);
}

async function sendViaTwilio(recipient, payload) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const form = new URLSearchParams({ To: recipient, From: TWILIO_FROM_NUMBER, Body: payload.message });
  const basic = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: form,
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Twilio HTTP ${res.status}`);
}

async function sendViaWebhook(channel, recipient, payload) {
  const webhookUrl = channel === "email" ? EMAIL_WEBHOOK_URL : SMS_WEBHOOK_URL;
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, recipient, ...payload }),
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
}

/**
 * Attempt to deliver one notification. Never throws — returns a status
 * object so it can be logged or stored.
 */
async function dispatch(channel, recipient, payload) {
  const note = {
    channel,
    provider: getProvider(channel),
    recipient: recipient || "",
    status: "PENDING_SEND",
    detail: "",
    attemptedAt: null,
  };
  if (!recipient) {
    note.status = "MISSING_RECIPIENT";
    note.detail = `No ${channel} recipient provided.`;
    return note;
  }
  if (!isConfigured(channel, note.provider)) {
    note.status = "NOT_CONFIGURED";
    note.detail = `No ${channel.toUpperCase()} provider configured.`;
    return note;
  }
  note.attemptedAt = new Date().toISOString();
  try {
    if (note.provider === "sendgrid") await sendViaSendGrid(recipient, payload);
    else if (note.provider === "twilio") await sendViaTwilio(recipient, payload);
    else await sendViaWebhook(channel, recipient, payload);
    note.status = "SENT";
    note.detail = `Accepted by ${note.provider} gateway.`;
  } catch (err) {
    note.status = "FAILED";
    note.detail = `${channel.toUpperCase()} via ${note.provider} failed: ${err.message}`;
  }
  return note;
}

/* ---------- message builders ---------- */

function money(n) {
  return `\u20B9${Number(n || 0).toLocaleString("en-IN")}`;
}

function orderSummaryLine(order) {
  if (order.type === "medicine") {
    const count = (order.items || []).reduce((s, i) => s + (i.qty || 0), 0);
    return `${count} item(s) from ${order.fulfilledBy?.name || "MedGuard"} — ETA ~${order.etaMinutes || 40} min`;
  }
  if (order.type === "lab") {
    const names = (order.tests || []).map((t) => t.name).join(", ");
    return `Lab tests: ${names || "—"}${order.slot ? ` — slot ${order.slot}` : ""}`;
  }
  const p = order.provider || {};
  return `${p.name || "Care visit"}${order.visitMode ? ` (${order.visitMode})` : ""}${order.slot ? ` — ${order.slot}` : ""}`;
}

function buildWelcome(user) {
  const link = WEBSITE_URL ? `\nVisit: ${WEBSITE_URL}` : "";
  const email = {
    subject: "Welcome to MedGuard Care",
    message:
      `Hi ${user.name || "there"},\n\n` +
      `Welcome to MedGuard Care! Your account (${user.email}) is ready.\n` +
      `You can now order medicines & devices, book lab tests, and consult doctors, nurses and caretakers at home.\n` +
      `Sign in any time with your email and password.` +
      link +
      `\n\n— The MedGuard Care Team`,
  };
  const sms = {
    message: `MedGuard Care: Welcome ${user.name || ""}! Your account is ready. Order medicines, lab tests & at-home care anytime.`.trim(),
  };
  return { email, sms };
}

function buildOrder(order) {
  const link = WEBSITE_URL ? `\nTrack: ${WEBSITE_URL}` : "";
  const email = {
    subject: `MedGuard Care order confirmed — ${order.id}`,
    message:
      `Hi ${order.customer?.name || "there"},\n\n` +
      `Your order ${order.id} is ${order.status || "PLACED"}.\n` +
      `${orderSummaryLine(order)}\n` +
      `Total payable: ${money(order.total)}\n` +
      `${order.plusMember ? "MedGuard Plus benefits applied (free delivery + member discount).\n" : ""}` +
      `We'll keep you posted on progress.` +
      link +
      `\n\n— The MedGuard Care Team`,
  };
  const sms = {
    message:
      `MedGuard Care: Order ${order.id} confirmed. ${orderSummaryLine(order)}. Total ${money(order.total)}.`,
  };
  return { email, sms };
}

/* ---------- public API (fire-and-forget) ---------- */

/**
 * Send both email + SMS for an event, in the background.
 * Returns immediately with a queued summary; actual delivery is async.
 */
function send(recipientEmail, recipientPhone, built) {
  const summary = [
    { channel: "email", recipient: recipientEmail || "", status: getProvider("email") === "none" ? "NOT_CONFIGURED" : "QUEUED" },
    { channel: "sms", recipient: recipientPhone || "", status: getProvider("sms") === "none" ? "NOT_CONFIGURED" : "QUEUED" },
  ];
  if (!anyChannelReady()) return summary; // nothing configured — skip work entirely
  // background dispatch, non-blocking
  Promise.allSettled([
    dispatch("email", recipientEmail, built.email),
    dispatch("sms", recipientPhone, built.sms),
  ]).catch(() => {});
  return summary;
}

function sendWelcome(user) {
  return send(user.email, user.phone, buildWelcome(user));
}

function sendOrder(order) {
  const c = order.customer || {};
  return send(c.email || "", c.phone || "", buildOrder(order));
}

module.exports = {
  sendWelcome,
  sendOrder,
  anyChannelReady,
  getProvider,
  isConfigured,
};
