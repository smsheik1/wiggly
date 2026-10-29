import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; plan?: string; pack?: string; status?: string }>;
}) {
  const params = await searchParams;
  if (params.status === "success") {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <p className="mt-3 text-sm">Go back to your agent and call wiggly_submit_draft again.</p>
      </main>
    );
  }
  if (!params.checkout) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">Checkout link is incomplete</h1>
        <p className="mt-3 text-sm">Ask your agent to call wiggly_submit_draft again and open the new link.</p>
      </main>
    );
  }
  const pack = params.pack === "1900";
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold">{pack ? "Buy 1,900 credits" : "Subscribe for 1,900 credits a month"}</h1>
      <p className="mt-3 text-sm">$19. Credits pay for image, video, and audio generation. Monthly credits reset each billing cycle. Credits you buy on top stay until you use them.</p>
      <form action="/api/billing/mcp-checkout" method="post" className="mt-6">
        <input type="hidden" name="checkout" value={params.checkout} />
        <input type="hidden" name="kind" value={pack ? "pack" : "subscription"} />
        <Button type="submit">Pay $19</Button>
      </form>
    </main>
  );
}
