import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Wiggly",
  description: "How Wiggly handles information when you use our services.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-base leading-7 text-slate-800 sm:py-20">
      <Link href="/discover" className="font-bold text-violet-700 underline">← Wiggly</Link>
      <h1 className="mt-8 text-4xl font-black tracking-tight text-slate-950">Privacy Policy</h1>
      <p className="mt-4 text-sm text-slate-600">Last updated: October 28, 2026</p>
      <div className="mt-8 space-y-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-950 [&_p+p]:mt-3 [&_a]:text-violet-700 [&_a]:underline">
        <section>
          <p>Wiggly is operated by Shahzeb Sheikh. This policy explains how we handle information when you visit Wiggly, create an account, connect an AI tool, submit a format, or use our services. Questions and privacy requests can be sent to <a href="mailto:buildwithshaz@gmail.com">buildwithshaz@gmail.com</a>.</p>
        </section>
        <section>
          <h2>Information we receive</h2>
          <p><strong>Account and sign-in information.</strong> WorkOS, our authentication provider, processes information needed to manage your account and sign-in, such as your email address, account identifier, authentication method and associated account information. WorkOS handles email-and-password sign-in.</p>
          <p><strong>Google sign-in.</strong> If you choose Google sign-in, Google and WorkOS handle the authorization flow. The configured permissions request basic identity information, including your Google account email and profile information, such as your name and profile picture when provided. WorkOS may associate that information with your Wiggly account. Wiggly’s MCP service uses the authenticated account identifier to identify your account and authorize requests. This sign-in configuration does not request access to your Google Gmail, Calendar or Drive.</p>
          <p><strong>Content and requests.</strong> Depending on the features you use, we may receive names, contact email addresses, URLs, format submissions, prompts or storyboards, photo labels, uploaded media, and generated results or links. Please obtain permission before submitting information about someone else.</p>
          <p><strong>Service and usage information.</strong> Our services and providers may process technical information such as IP address, browser or device information, requests, timestamps and errors. When configured, Wiggly uses PostHog for product analytics, including events such as a format submission or handoff. Wiggly also uses browser storage for some local preferences and session-related functionality.</p>
          <p><strong>Billing and communications.</strong> If you use a paid feature, a payment provider may process payment details; Wiggly may retain subscription, credit and transaction information, including a payment-provider customer identifier. We also receive information you provide when you contact us.</p>
        </section>
        <section>
          <h2>How we use information</h2>
          <p>We use information to operate and secure Wiggly; manage accounts and authenticate users; authorize MCP requests; provide requested features; respond to submissions and support requests; manage credits and payments where applicable; diagnose errors; understand product usage; and meet legal obligations. We use Google sign-in information for account identification, authentication and account management.</p>
        </section>
        <section>
          <h2>When information is shared</h2>
          <p>We share information with service providers as needed to operate Wiggly, including WorkOS for authentication, Convex for application data, PostHog for analytics when configured, hosting and infrastructure providers, and payment or media providers when a feature uses them. Your AI application or coding agent may receive information returned by the MCP tools you invoke; that application’s own privacy practices also apply. We may disclose information when required by law or to protect rights and security.</p>
        </section>
        <section>
          <h2>Storage and retention</h2>
          <p>We retain information while needed to operate the service, maintain accounts and records, address security and support issues, and meet applicable legal obligations. The MCP service does not set an automatic deletion schedule for account and job records; they may remain until manually removed. An upload link’s expiration does not necessarily mean uploaded content has been deleted. Retention by service providers and backups may differ.</p>
        </section>
        <section>
          <h2>Your choices and requests</h2>
          <p>Contact <a href="mailto:buildwithshaz@gmail.com">buildwithshaz@gmail.com</a> to request access to, correction of, or deletion of your personal information, or to ask about other rights available where you live. We may need to verify your identity and consider applicable legal obligations before responding. You can manage Google account connections through your Google Account settings; disconnecting Google does not necessarily delete your Wiggly account or information already stored by Wiggly or its providers.</p>
        </section>
        <section>
          <h2>Security and international processing</h2>
          <p>We use measures intended to protect information, including authentication and access controls, but no service can guarantee absolute security. Wiggly and its service providers may process information in countries other than the one where you live.</p>
        </section>
        <section>
          <h2>Changes and contact</h2>
          <p>We may update this policy as our services or practices change. We will update the date above and provide any notice required by applicable law. Contact <a href="mailto:buildwithshaz@gmail.com">buildwithshaz@gmail.com</a> with questions or privacy requests.</p>
        </section>
      </div>
    </main>
  );
}
