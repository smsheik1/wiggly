import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { McpSetupPage } from "@/features/discovery/McpSetupPage";
import { getMcpSetupAgent, mcpSetupAgents } from "@/features/discovery/mcpSetupAgents";

export function generateStaticParams() {
  return mcpSetupAgents.map((agent) => ({ agent: agent.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agent: string }>;
}): Promise<Metadata> {
  const { agent: slug } = await params;
  const agent = getMcpSetupAgent(slug);
  if (!agent) return {};
  return {
    title: `Connect Wiggly MCP to ${agent.name} | Setup Guide`,
    description: `Connect ${agent.name} to Wiggly's on-brand creative engine.`,
  };
}

export default async function McpSetupAgentPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: slug } = await params;
  const agent = getMcpSetupAgent(slug);
  if (!agent) notFound();
  return <McpSetupPage agent={agent} />;
}
