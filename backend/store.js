"use strict";

/**
 * Storage abstraction for MedGuard Care.
 * - If DATABASE_URL is set -> PostgreSQL (durable, via optional `pg` driver).
 * - Otherwise -> local JSON files under backend/data (great for local dev).
 * Same async API in both modes.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const CONSULTS_FILE = path.join(DATA_DIR, "consultations.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");

const DATABASE_URL = process.env.DATABASE_URL || "";

let pool = null;
let ready = null;

function usingDb() {
  return Boolean(DATABASE_URL);
}

function mode() {
  return usingDb() ? "postgres" : "file";
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (_e) {
    return fallback;
  }
}

function writeJsonFile(file, value) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

async function ensureReady() {
  if (ready) return ready;
  ready = (async () => {
    if (usingDb()) {
      // Lazy require so `pg` is only needed when a DB is configured.
      const { Pool } = require("pg");
      const isLocal = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
      pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: isLocal ? false : { rejectUnauthorized: false },
      });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS consultations (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tickets (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    } else {
      ensureDataDir();
      if (!fs.existsSync(ORDERS_FILE)) writeJsonFile(ORDERS_FILE, []);
      if (!fs.existsSync(CONSULTS_FILE)) writeJsonFile(CONSULTS_FILE, []);
      if (!fs.existsSync(TICKETS_FILE)) writeJsonFile(TICKETS_FILE, []);
    }
  })();
  return ready;
}

/* ---------- orders (medicine delivery + care bookings) ---------- */

async function getOrders() {
  await ensureReady();
  if (usingDb()) {
    const result = await pool.query("SELECT data FROM orders ORDER BY created_at ASC");
    return result.rows.map((row) => row.data);
  }
  const list = readJsonFile(ORDERS_FILE, []);
  return Array.isArray(list) ? list : [];
}

async function saveOrders(orders) {
  await ensureReady();
  if (usingDb()) {
    for (const order of orders) {
      await pool.query(
        "INSERT INTO orders (id, data, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
        [order.id, order, order.createdAt || new Date().toISOString()]
      );
    }
    return;
  }
  // File mode: upsert by id so saving a subset never wipes other records.
  const existing = readJsonFile(ORDERS_FILE, []);
  const byId = new Map((Array.isArray(existing) ? existing : []).map((o) => [o.id, o]));
  for (const order of orders) byId.set(order.id, order);
  writeJsonFile(ORDERS_FILE, [...byId.values()]);
}

/* ---------- consultations (online doctor sessions) ---------- */

async function getConsultations() {
  await ensureReady();
  if (usingDb()) {
    const result = await pool.query("SELECT data FROM consultations ORDER BY created_at ASC");
    return result.rows.map((row) => row.data);
  }
  const list = readJsonFile(CONSULTS_FILE, []);
  return Array.isArray(list) ? list : [];
}

async function saveConsultations(consults) {
  await ensureReady();
  if (usingDb()) {
    for (const c of consults) {
      await pool.query(
        "INSERT INTO consultations (id, data, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
        [c.id, c, c.createdAt || new Date().toISOString()]
      );
    }
    return;
  }
  const existing = readJsonFile(CONSULTS_FILE, []);
  const byId = new Map((Array.isArray(existing) ? existing : []).map((c) => [c.id, c]));
  for (const c of consults) byId.set(c.id, c);
  writeJsonFile(CONSULTS_FILE, [...byId.values()]);
}

/* ---------- support tickets ---------- */

async function getTickets() {
  await ensureReady();
  if (usingDb()) {
    const result = await pool.query("SELECT data FROM tickets ORDER BY created_at ASC");
    return result.rows.map((row) => row.data);
  }
  const list = readJsonFile(TICKETS_FILE, []);
  return Array.isArray(list) ? list : [];
}

async function saveTickets(tickets) {
  await ensureReady();
  if (usingDb()) {
    for (const t of tickets) {
      await pool.query(
        "INSERT INTO tickets (id, data, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
        [t.id, t, t.createdAt || new Date().toISOString()]
      );
    }
    return;
  }
  const existing = readJsonFile(TICKETS_FILE, []);
  const byId = new Map((Array.isArray(existing) ? existing : []).map((t) => [t.id, t]));
  for (const t of tickets) byId.set(t.id, t);
  writeJsonFile(TICKETS_FILE, [...byId.values()]);
}

module.exports = {
  mode,
  ensureReady,
  getOrders,
  saveOrders,
  getConsultations,
  saveConsultations,
  getTickets,
  saveTickets,
};
