import { existsSync } from "node:fs";
import path from "node:path";

// Load .env if present. Node 22 has this built in, so no dotenv dependency.
if (existsSync(".env")) process.loadEnvFile(".env");

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const config = {
  anthropicEnabled: Boolean(env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN")),
  googlePlacesKey: env("GOOGLE_PLACES_API_KEY"),
  maxAiSpendUsd: Number(env("MAX_AI_SPEND_PER_RUN_USD", "5")),
  dataDir: path.resolve(env("DATA_DIR", "./data")),
  outputDir: path.resolve(env("OUTPUT_DIR", "./output")),
  previewBaseUrl: env("PREVIEW_BASE_URL", "http://localhost:4173").replace(/\/$/, ""),
  agency: {
    name: env("AGENCY_NAME"), // empty = left out of demo banners
    email: env("AGENCY_EMAIL", "hello@example.com"),
    address: env("AGENCY_ADDRESS", ""),
  },
  chromiumPath: env("CHROMIUM_PATH") || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : ""),
  // Identifies our crawler honestly so site owners can see who audited them.
  userAgent: `AgencyAuditBot/0.1 (+mailto:${env("AGENCY_EMAIL", "hello@example.com")})`,
};
