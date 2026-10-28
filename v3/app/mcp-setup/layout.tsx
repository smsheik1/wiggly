import type { ReactNode } from "react";
import { DM_Sans, Instrument_Serif, Manrope } from "next/font/google";

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mcp-body",
  display: "swap",
});

const display = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-mcp-display",
  display: "swap",
});

const editorial = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-editorial",
  display: "swap",
});

export default function McpSetupLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${body.variable} ${display.variable} ${editorial.variable} font-mcp`}>
      <style>{`
        .font-mcp { font-family: var(--font-mcp-body), "DM Sans", ui-sans-serif, system-ui, sans-serif; color: #12110f; background: #f7f5ee; }
        .font-mcp .font-heading { font-family: var(--font-mcp-display), Manrope, ui-sans-serif, system-ui, sans-serif; }
        .font-mcp .font-editorial { font-family: var(--font-editorial), "Instrument Serif", Georgia, serif; }
      `}</style>
      {children}
    </div>
  );
}
