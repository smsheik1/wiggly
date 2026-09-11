import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Universal Dual-Engine Live Progress HUD
 * Engine 1: In-place ANSI Terminal ASCII Art (Claude Code, Cursor terminal, zsh/bash)
 * Engine 2: Auto-updating progress.html + progress.json for web/IDE previews
 */

export function formatAsciiBar(percent, totalChars = 32) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * totalChars);
  const empty = totalChars - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export function padRight(str, len) {
  if (str.length >= len) return str.slice(0, len);
  return str + " ".repeat(len - str.length);
}

export function createProgressHud(options = {}) {
  const {
    title = "WIGGLY ENGINE v0.4.0",
    targetSlug = "tutorial-video",
    rootDir = process.cwd(),
    totalStages = 12,
  } = options;

  let lastLineCount = 0;
  let lastPercentLogged = -1;
  let startTime = Date.now();
  let currentStatus = "rendering";

  function getElapsedString() {
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}s`;
  }

  function renderTerminalBox(state) {
    const isTTY = Boolean(process.stdout.isTTY);
    const pct = Math.round(state.percent || 0);
    const bar = formatAsciiBar(pct, 28);
    const elapsed = getElapsedString();

    const stageNum = String(state.stageIndex || 1).padStart(2, "0");
    const totalNum = String(state.totalStages || totalStages).padStart(2, "0");
    const stageLine = `► Stage: [${stageNum}/${totalNum}] ${state.stageName || "Processing..."}`;

    let frameLine = "► Frame: -- / --";
    if (state.totalFrames) {
      const curFrame = (state.currentFrame || 0).toLocaleString();
      const totFrame = state.totalFrames.toLocaleString();
      const eta = state.etaSeconds ? `~${Math.round(state.etaSeconds)}s` : "--";
      frameLine = `► Frame: ${curFrame} / ${totFrame}  •  ETA: ${eta}`;
    }

    const harvestCheck = pct >= 20 ? "✓" : "•";
    const voiceCheck = pct >= 60 ? "✓" : "○";
    const compCheck = pct >= 100 ? "✓" : (pct >= 60 ? "•" : "○");

    const innerWidth = 60;
    const headerContent = ` ${title} ── ${targetSlug.toUpperCase()} `;
    const headerPad = Math.max(0, innerWidth - headerContent.length);

    const lines = [
      `┌${"─".repeat(innerWidth)}┐`,
      `│${headerContent}${"─".repeat(headerPad)}│`,
      `├${"─".repeat(innerWidth)}┤`,
      `│${" ".repeat(innerWidth)}│`,
      `│  ${padRight(`STATUS [${bar}]  ${pct}%`, innerWidth - 4)}  │`,
      `│${" ".repeat(innerWidth)}│`,
      `│  ${padRight(stageLine, innerWidth - 4)}  │`,
      `│  ${padRight(frameLine, innerWidth - 4)}  │`,
      `│${" ".repeat(innerWidth)}│`,
      `│  ${padRight(`[${harvestCheck}] Assets      [${voiceCheck}] Voice Synth     [${compCheck}] Compositor   (${elapsed})`, innerWidth - 4)}  │`,
      `└${"─".repeat(innerWidth)}┘`,
    ];

    if (isTTY) {
      if (lastLineCount > 0) {
        process.stdout.write(`\x1b[${lastLineCount}A`);
      }
      for (const line of lines) {
        process.stdout.write(`\x1b[2K\r${line}\n`);
      }
      lastLineCount = lines.length;
    } else {
      // Non-TTY (dumb pipe, CI, or file redirect): print milestones
      const stepInterval = Math.floor(pct / 10) * 10;
      if (stepInterval !== lastPercentLogged) {
        lastPercentLogged = stepInterval;
        console.log(`[wiggly] ${pct}% - ${stageLine} (${elapsed})`);
      }
    }
  }

  function renderTerminalComplete(finalState) {
    const isTTY = Boolean(process.stdout.isTTY);
    const innerWidth = 60;
    const elapsed = getElapsedString();

    const lines = [
      `┌${"─".repeat(innerWidth)}┐`,
      `│ ${padRight(`${title} ── COMPLETE`, innerWidth - 2)} │`,
      `├${"─".repeat(innerWidth)}┤`,
      `│${" ".repeat(innerWidth)}│`,
      `│  ${padRight(`STATUS [${"█".repeat(28)}]  100% DONE`, innerWidth - 4)}  │`,
      `│${" ".repeat(innerWidth)}│`,
      `│  ${padRight(`► Output : ${finalState.videoPath || "outputs/final.mp4"}`, innerWidth - 4)}  │`,
      `│  ${padRight(`► Duration: ${finalState.durationSeconds || 0}s  •  Time: ${elapsed}`, innerWidth - 4)}  │`,
      `│${" ".repeat(innerWidth)}│`,
      `│  ${padRight(`[✓] Assets      [✓] Voice Synth     [✓] Compositor verified`, innerWidth - 4)}  │`,
      `└${"─".repeat(innerWidth)}┘`,
    ];

    if (isTTY) {
      if (lastLineCount > 0) {
        process.stdout.write(`\x1b[${lastLineCount}A`);
      }
      for (const line of lines) {
        process.stdout.write(`\x1b[2K\r${line}\n`);
      }
      lastLineCount = 0;
    } else {
      console.log(`[wiggly] 100% COMPLETE - ${finalState.videoPath} (${elapsed})`);
    }
  }

  function writeWebHud(state) {
    try {
      mkdirSync(rootDir, { recursive: true });
      const jsonPath = path.join(rootDir, "progress.json");
      const htmlPath = path.join(rootDir, "progress.html");

      const jsonPayload = {
        title,
        targetSlug,
        status: currentStatus,
        percent: Math.round(state.percent || 0),
        stageIndex: state.stageIndex || 1,
        totalStages: state.totalStages || totalStages,
        stageName: state.stageName || "Processing...",
        currentFrame: state.currentFrame || 0,
        totalFrames: state.totalFrames || 0,
        etaSeconds: state.etaSeconds || 0,
        elapsed: getElapsedString(),
        videoPath: state.videoPath || null,
        updatedAt: new Date().toISOString(),
      };

      writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2), "utf8");

      const pct = jsonPayload.percent;
      const bar = formatAsciiBar(pct, 36);

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="2">
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    .cursor-blink { animation: blink 1s infinite; }
    .crt-glow { text-shadow: 0 0 10px rgba(196, 255, 57, 0.4); }
    .bar-glow { box-shadow: 0 0 15px rgba(196, 255, 57, 0.3); }
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-2 font-mono flex items-center justify-center select-none">
  <div class="w-full max-w-2xl bg-[#080b09] text-[#e2e8f0] border-2 border-[#c4ff39]/50 rounded-xl p-5 shadow-2xl overflow-hidden relative">
    
    <div class="flex items-center justify-between border-b border-[#222c24] pb-3 text-xs tracking-wider">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full ${currentStatus === "completed" ? "bg-[#c4ff39]" : "bg-[#c4ff39] animate-pulse"}"></span>
        <span class="font-bold text-[#c4ff39] crt-glow">${title}</span>
        <span class="text-[#64748b]">──</span>
        <span class="text-slate-300 font-semibold uppercase">${targetSlug}</span>
      </div>
      <div class="text-[#64748b] text-[11px]" id="elapsed-time">${jsonPayload.elapsed}</div>
    </div>

    <div class="my-5">
      <div class="flex justify-between items-baseline mb-2">
        <div class="text-xs text-[#aeb8b0] flex items-center gap-2">
          <span class="text-[#c4ff39]">${currentStatus === "completed" ? "FINISHED" : "RENDERING"}</span>
          <span class="text-[#64748b]">${currentStatus === "completed" ? "✓" : "⠋"}</span>
        </div>
        <div class="text-2xl font-black text-[#c4ff39] crt-glow tracking-tight" id="pct-label">${pct}%</div>
      </div>

      <div class="bg-[#111612] border border-[#233125] rounded-lg p-2 flex items-center bar-glow">
        <div class="text-base tracking-[-0.08em] font-bold text-[#c4ff39] truncate w-full" id="ascii-bar">
          ${bar}
        </div>
      </div>
    </div>

    <div class="bg-[#0e130f] border border-[#1b251d] rounded-lg p-3 text-xs space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="text-[#64748b]">STAGE:</span>
        <span class="text-slate-200 font-semibold truncate ml-2">[${String(jsonPayload.stageIndex).padStart(2, "0")}/${String(jsonPayload.totalStages).padStart(2, "0")}] ${jsonPayload.stageName}</span>
      </div>
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-[#64748b]">FRAME:</span>
        <span class="text-slate-400">${jsonPayload.currentFrame.toLocaleString()} / ${jsonPayload.totalFrames ? jsonPayload.totalFrames.toLocaleString() : "--"} frames</span>
      </div>
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-[#64748b]">ESTIMATED TIME:</span>
        <span class="text-[#c4ff39]">${currentStatus === "completed" ? "Done" : (jsonPayload.etaSeconds ? `~${Math.round(jsonPayload.etaSeconds)}s remaining` : "--")}</span>
      </div>
    </div>

    <div class="mt-4 pt-3 border-t border-[#1a231b] flex items-center justify-between text-[11px]">
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1 ${pct >= 20 ? "text-[#c4ff39]" : "text-[#64748b]"}">
          <span>${pct >= 20 ? "●" : "○"}</span> Visual Assets
        </span>
        <span class="flex items-center gap-1 ${pct >= 60 ? "text-[#c4ff39]" : "text-[#64748b]"}">
          <span>${pct >= 60 ? "●" : "○"}</span> Voice Synth
        </span>
        <span class="flex items-center gap-1 ${pct >= 100 ? "text-[#c4ff39]" : "text-[#64748b]"}">
          <span>${pct >= 100 ? "●" : "○"}</span> 1080p Master
        </span>
      </div>
      <span class="text-[#64748b] text-[10px] cursor-blink">${currentStatus === "completed" ? "● SAVED" : "█ REC"}</span>
    </div>

  </div>

  <script>
    // Live AJAX polling to update in-place without page flickering
    async function poll() {
      try {
        const res = await fetch('progress.json?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('pct-label').innerText = data.percent + '%';
        const total = 36;
        const filled = Math.round((data.percent / 100) * total);
        document.getElementById('ascii-bar').innerText = '█'.repeat(filled) + '░'.repeat(total - filled);
        document.getElementById('elapsed-time').innerText = data.elapsed;
      } catch (e) {}
    }
    setInterval(poll, 400);
  </script>
</body>
</html>`;

      writeFileSync(htmlPath, htmlContent, "utf8");
    } catch (err) {
      // Non-critical if writing file fails
    }
  }

  return {
    update(state) {
      currentStatus = "rendering";
      renderTerminalBox(state);
      writeWebHud(state);
    },

    finish(finalState) {
      currentStatus = "completed";
      const state = {
        percent: 100,
        stageIndex: totalStages,
        totalStages,
        stageName: "Master composition rendered and verified",
        ...finalState,
      };
      renderTerminalComplete(state);
      writeWebHud(state);
    },

    fail(err) {
      currentStatus = "error";
      if (lastLineCount > 0 && process.stdout.isTTY) {
        process.stdout.write("\n");
      }
      console.error(`\n[wiggly error] ${err.message || err}\n`);
    },
  };
}
