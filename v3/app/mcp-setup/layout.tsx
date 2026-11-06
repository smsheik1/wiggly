import type { ReactNode } from "react";

export default function McpSetupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="font-mcp">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Instrument+Serif:ital@0;1&family=Manrope:wght@500..800&display=swap');
        .font-mcp { font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif; color: #12110f; background: #f7f5ee; }
        .font-mcp .font-heading { font-family: Manrope, ui-sans-serif, system-ui, sans-serif; }
        .font-mcp .font-editorial { font-family: "Instrument Serif", Georgia, serif; }
      `}</style>
      {children}
    </div>
  );
}
