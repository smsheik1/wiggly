import { ConvexHttpClient } from "convex/browser";
import { internal } from "../../../../convex/_generated/api";
import { stripeClient, stripeWebhookSecret } from "../../../../features/mcp/stripe-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function convexClient() {
  const url = process.env.V3_CONVEX_URL || process.env.NEXT_PUBLIC_V3_CONVEX_URL;
  const key = process.env.V3_CONVEX_DEPLOY_KEY;
  if (!url || !key) {
    throw new Error("Set V3_CONVEX_URL and V3_CONVEX_DEPLOY_KEY before Stripe can grant credits. Do not deploy the discovery-only Convex schema.");
  }
  const client = new ConvexHttpClient(url) as ConvexHttpClient & { setAdminAuth(token: string): void };
  client.setAdminAuth(key);
  return client;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature.", { status: 400 });
  try {
    const stripe = await stripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, await stripeWebhookSecret());
    const client = convexClient();
    const grant = (args: { eventId: string; checkoutToken?: string; stripeCustomerId?: string; kind: "subscription" | "pack" | "renewal" }) =>
      (client.mutation as (ref: unknown, args: unknown) => Promise<unknown>)(internal.mcpFilm.grantPayment, args);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const checkoutToken = session.metadata?.checkoutToken || session.client_reference_id || undefined;
      const kind = session.mode === "subscription" ? "subscription" : "pack";
      const customer = typeof session.customer === "string" ? session.customer : undefined;
      await grant({ eventId: event.id, checkoutToken, stripeCustomerId: customer, kind });
    }
    if (event.type === "invoice.paid" && event.data.object.billing_reason === "subscription_cycle") {
      const customer = typeof event.data.object.customer === "string" ? event.data.object.customer : undefined;
      await grant({ eventId: event.id, stripeCustomerId: customer, kind: "renewal" });
    }
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook failed.";
    console.error(message);
    return new Response(message, { status: 500 });
  }
}
