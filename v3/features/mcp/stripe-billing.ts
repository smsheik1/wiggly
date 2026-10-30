import { readFile } from "node:fs/promises";
import path from "node:path";
import Stripe from "stripe";
import type { CheckoutKind } from "./film-ledger";

export function stripeSetupError(missing: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET") {
  if (missing === "STRIPE_SECRET_KEY") {
    return [
      "Stripe is not connected. STRIPE_SECRET_KEY is missing, so checkout cannot start.",
      "1. Open https://dashboard.stripe.com/apikeys",
      "2. Reveal the Secret key.",
      "3. Open secrets.env at the Wiggly repo root.",
      "4. Add a line: STRIPE_SECRET_KEY=sk_live_...",
      "5. Save the file and retry the checkout.",
    ].join("\n");
  }
  return [
    "Stripe webhooks are not connected. STRIPE_WEBHOOK_SECRET is missing, so a payment cannot grant credits.",
    "1. Open https://dashboard.stripe.com/webhooks",
    "2. Add an endpoint for https://wiggly.agentenamel.com/api/billing/webhook",
    "3. Select checkout.session.completed and invoice.paid.",
    "4. Open the endpoint and reveal the signing secret.",
    "5. Open secrets.env at the Wiggly repo root.",
    "6. Add a line: STRIPE_WEBHOOK_SECRET=whsec_...",
    "7. Save the file and send the webhook again.",
  ].join("\n");
}

async function readSecret(name: string) {
  if (process.env[name]?.trim()) return process.env[name]!.trim();
  for (const root of [process.cwd(), path.join(process.cwd(), ".."), path.join(process.cwd(), "../..")]) {
    try {
      const content = await readFile(path.join(root, "secrets.env"), "utf8");
      const match = content.match(new RegExp(`^${name}=([^\\r\\n]+)`, "m"));
      if (match?.[1]?.trim()) return match[1].trim();
    } catch {
      // The next parent may hold the file.
    }
  }
  return null;
}

export async function stripeClient(options?: { ignoreSecretsFile?: boolean; apiKey?: string }) {
  const key = options?.apiKey ?? (options?.ignoreSecretsFile ? (process.env.STRIPE_SECRET_KEY?.trim() || null) : await readSecret("STRIPE_SECRET_KEY"));
  if (!key) throw new Error(stripeSetupError("STRIPE_SECRET_KEY"));
  return new Stripe(key);
}

export async function stripeWebhookSecret(options?: { ignoreSecretsFile?: boolean; secret?: string }) {
  const secret = options?.secret ?? (options?.ignoreSecretsFile ? (process.env.STRIPE_WEBHOOK_SECRET?.trim() || null) : await readSecret("STRIPE_WEBHOOK_SECRET"));
  if (!secret) throw new Error(stripeSetupError("STRIPE_WEBHOOK_SECRET"));
  return secret;
}

export async function createCheckoutSession(input: { kind: CheckoutKind; checkoutToken: string; origin: string }) {
  const stripe = await stripeClient();
  const subscription = input.kind === "subscription";
  return stripe.checkout.sessions.create({
    mode: subscription ? "subscription" : "payment",
    client_reference_id: input.checkoutToken,
    metadata: { checkoutToken: input.checkoutToken, kind: input.kind },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: 1900,
        product_data: { name: subscription ? "Wiggly monthly credits" : "Wiggly credit pack" },
        ...(subscription ? { recurring: { interval: "month" } } : {}),
      },
    }],
    success_url: `${input.origin}/billing/credits?checkout=${input.checkoutToken}&status=success`,
    cancel_url: `${input.origin}/billing/credits?checkout=${input.checkoutToken}&status=cancel`,
  });
}
