import { publicOrigin } from "../../../../features/mcp/public-origin";
import { createCheckoutSession } from "../../../../features/mcp/stripe-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const checkout = String(form.get("checkout") ?? "");
  const kind = form.get("kind") === "pack" ? "pack" : "subscription";
  if (!checkout) {
    return Response.json({ error: "Checkout link is incomplete. Call wiggly_submit_draft again." }, { status: 400 });
  }
  try {
    const origin = publicOrigin();
    const session = await createCheckoutSession({ kind, checkoutToken: checkout, origin });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return Response.redirect(session.url, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe checkout failed.";
    console.error(message);
    return new Response(message, { status: 500 });
  }
}
