import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import type { Business, BusinessInput } from "./types.ts";

// SQLite via Node's built-in driver: zero setup, one file, easy to back up.
// When the business outgrows it, the same tables move to Postgres unchanged.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  data TEXT NOT NULL,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source, source_id)
);
-- One row per business per artifact kind (audit, signals, brief, content, score, quote, qa, demo).
CREATE TABLE IF NOT EXISTS artifacts (
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (business_id, kind)
);
-- Pipeline stage per business: discovered -> audited -> qualified/disqualified -> analyzed -> generated -> qa_passed/qa_failed.
CREATE TABLE IF NOT EXISTS stages (
  business_id INTEGER PRIMARY KEY REFERENCES businesses(id),
  stage TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  business_id INTEGER,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Anyone who asked not to be contacted, or must never be contacted. Checked before any outreach.
CREATE TABLE IF NOT EXISTS suppression (
  value TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY,
  business_id INTEGER,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export class Store {
  readonly db: DatabaseSync;

  constructor(file = path.join(config.dataDir, "agency.db")) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(SCHEMA);
  }

  /** Insert or refresh a business; returns its id. Re-discovery never creates duplicates. */
  upsertBusiness(b: BusinessInput): number {
    const row = this.db
      .prepare(
        `INSERT INTO businesses (source, source_id, name, industry, data) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (source, source_id) DO UPDATE SET name = excluded.name, industry = excluded.industry, data = excluded.data
         RETURNING id`,
      )
      .get(b.source, b.sourceId, b.name, b.industry, JSON.stringify(b)) as { id: number };
    if (!this.getStage(row.id)) this.setStage(row.id, "discovered");
    return row.id;
  }

  getBusiness(id: number): Business | null {
    const row = this.db.prepare("SELECT id, data FROM businesses WHERE id = ?").get(id) as
      | { id: number; data: string }
      | undefined;
    return row ? { ...(JSON.parse(row.data) as BusinessInput), id: row.id } : null;
  }

  listBusinesses(stage?: string): (Business & { stage: string })[] {
    const rows = this.db
      .prepare(
        `SELECT b.id, b.data, s.stage FROM businesses b JOIN stages s ON s.business_id = b.id
         WHERE (? IS NULL OR s.stage = ?) ORDER BY b.id`,
      )
      .all(stage ?? null, stage ?? null) as { id: number; data: string; stage: string }[];
    return rows.map((r) => ({ ...(JSON.parse(r.data) as BusinessInput), id: r.id, stage: r.stage }));
  }

  setArtifact(businessId: number, kind: string, data: unknown): void {
    this.db
      .prepare(
        `INSERT INTO artifacts (business_id, kind, data) VALUES (?, ?, ?)
         ON CONFLICT (business_id, kind) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
      )
      .run(businessId, kind, JSON.stringify(data));
  }

  getArtifact<T>(businessId: number, kind: string): T | null {
    const row = this.db.prepare("SELECT data FROM artifacts WHERE business_id = ? AND kind = ?").get(businessId, kind) as
      | { data: string }
      | undefined;
    return row ? (JSON.parse(row.data) as T) : null;
  }

  getStage(businessId: number): string | null {
    const row = this.db.prepare("SELECT stage FROM stages WHERE business_id = ?").get(businessId) as
      | { stage: string }
      | undefined;
    return row?.stage ?? null;
  }

  setStage(businessId: number, stage: string): void {
    this.db
      .prepare(
        `INSERT INTO stages (business_id, stage) VALUES (?, ?)
         ON CONFLICT (business_id) DO UPDATE SET stage = excluded.stage, updated_at = datetime('now')`,
      )
      .run(businessId, stage);
    this.log(businessId, "stage", stage);
  }

  log(businessId: number | null, type: string, message: string): void {
    this.db.prepare("INSERT INTO events (business_id, type, message) VALUES (?, ?, ?)").run(businessId, type, message);
  }

  events(businessId: number): { type: string; message: string; created_at: string }[] {
    return this.db
      .prepare("SELECT type, message, created_at FROM events WHERE business_id = ? ORDER BY id")
      .all(businessId) as { type: string; message: string; created_at: string }[];
  }

  suppress(value: string, reason: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO suppression (value, reason) VALUES (?, ?)")
      .run(normalizeContact(value), reason);
  }

  isSuppressed(...values: (string | undefined)[]): boolean {
    const stmt = this.db.prepare("SELECT 1 FROM suppression WHERE value = ?");
    return values.some((v) => v && stmt.get(normalizeContact(v)));
  }

  recordAiUsage(u: {
    businessId: number | null;
    purpose: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }): void {
    this.db
      .prepare(
        "INSERT INTO ai_usage (business_id, purpose, model, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(u.businessId, u.purpose, u.model, u.inputTokens, u.outputTokens, u.costUsd);
  }

  aiSpend(businessId?: number): number {
    const row = this.db
      .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage WHERE (? IS NULL OR business_id = ?)")
      .get(businessId ?? null, businessId ?? null) as { total: number };
    return row.total;
  }
}

/** Domains and emails are compared case-insensitively; a suppressed domain blocks every address on it. */
export function normalizeContact(value: string): string {
  const v = value.trim().toLowerCase();
  try {
    if (v.startsWith("http")) return new URL(v).hostname.replace(/^www\./, "");
  } catch {
    // not a URL
  }
  return v.replace(/^www\./, "");
}
