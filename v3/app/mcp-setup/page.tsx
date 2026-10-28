import type { Metadata } from "next";
import { McpSetupPage } from "@/features/discovery/McpSetupPage";

export const metadata: Metadata = {
  title: "Connect Wiggly MCP to Your AI Agent | Setup Guide",
  description: "Connect Wiggly to Claude, ChatGPT, Cursor, and any MCP client.",
};

export default function McpSetupIndexPage() {
  return <McpSetupPage agent={null} />;
}
