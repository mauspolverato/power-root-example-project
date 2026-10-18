import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { config } from "./config.ts";
import type { Store } from "./db.ts";

// One place for every Claude call: structured output, refusal handling,
// cost accounting and the per-run spend ceiling. Swap models or providers
// here without touching the pipeline.

export const MODEL = "claude-opus-5-5";
// USD per million tokens (input, output) for MODEL. Update if pricing changes.
const PRICE_PER_MTOK = { input: 4, output: 20 };

export class BudgetExceededError extends Error {}
export class RefusalError extends Error {}

let client: Anthropic | null = null;
let runSpendUsd = 0;

export function aiAvailable(): boolean {
  return config.anthropicEnabled && runSpendUsd < config.maxAiSpendUsd;
}

export async function generateStructured<S extends z.ZodType>(opts: {
  store: Store;
  businessId: number | null;
  purpose: string;
  schema: S;
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  if (!config.anthropicEnabled) throw new Error("ANTHROPIC_API_KEY is not set");
  if (runSpendUsd >= config.maxAiSpendUsd) throw new BudgetExceededError(`AI budget of $${config.maxAiSpendUsd} reached for this run`);
  client ??= new Anthropic();

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // If the model declines for policy reasons, the API retries on its recommended fallback model.
    fallbacks: "default",
    system: opts.system,
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: "user", content: opts.prompt }],
  });

  const cost =
    (response.usage.input_tokens * PRICE_PER_MTOK.input + response.usage.output_tokens * PRICE_PER_MTOK.output) / 1_000_000;
  runSpendUsd += cost;
  opts.store.recordAiUsage({
    businessId: opts.businessId,
    purpose: opts.purpose,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd: cost,
  });

  if (response.stop_reason === "refusal") throw new RefusalError(`Model declined (${response.stop_details?.category ?? "unknown"})`);
  if (response.stop_reason === "max_tokens") throw new Error("Model output was cut off at max_tokens");
  if (!response.parsed_output) throw new Error("Model output did not match the expected schema");
  return response.parsed_output;
}
