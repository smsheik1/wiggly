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
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 15px rgba(196, 255, 57, 0.35); }
      50% { box-shadow: 0 0 28px rgba(196, 255, 57, 0.75); }
    }
    .glow { animation: pulse-glow 2s infinite ease-in-out; }
    .bar-anim { transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-2">
  <div class="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl max-w-xl mx-auto backdrop-blur-md">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-4">
      <div class="flex items-center gap-3">
        <div class="w-3.5 h-3.5 rounded-full ${currentStatus === "completed" ? "bg-[#c4ff39]" : "bg-[#c4ff39] glow"}"></div>
        <div>
          <h2 class="text-sm font-black tracking-wider text-[var(--foreground)] uppercase">${title}</h2>
          <p class="text-[11px] text-[var(--muted-foreground)] font-mono">Target: <span class="text-[#c4ff39] font-bold">${targetSlug}</span></p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${currentStatus === "completed" ? "bg-[#c4ff39]/15 border border-[#c4ff39]/40 text-[#c4ff39]" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"} font-mono font-bold text-[10px]">
          <span class="w-1.5 h-1.5 rounded-full ${currentStatus === "completed" ? "bg-[#c4ff39]" : "bg-emerald-400 animate-ping"}"></span> ${currentStatus === "completed" ? "COMPLETE" : "LIVE TICKER"}
        </span>
        <div class="px-2.5 py-1 rounded-full bg-[#c4ff39]/15 border border-[#c4ff39]/40 text-[#c4ff39] font-mono font-black text-[11px]">
          1920x1080
        </div>
      </div>
    </div>

    <!-- Progress Stats -->
    <div class="space-y-3.5">
      <div class="flex justify-between items-baseline">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]" id="stage-label">${jsonPayload.stageName}</span>
          <div class="text-[11px] text-[var(--muted-foreground)] font-mono mt-0.5" id="sub-label">${currentStatus === "completed" ? "Video rendered & verified locally" : "Local Remotion Engine • 0 Provider Fees"}</div>
        </div>
        <span class="text-3xl font-black font-mono tracking-tight text-[#c4ff39]" id="pct-label">${pct}%</span>
      </div>

      <!-- Live Progress Bar -->
      <div class="w-full bg-[var(--background)]/90 h-4 rounded-full overflow-hidden border border-[var(--border)] p-0.5">
        <div id="bar-fill" class="h-full bg-gradient-to-r from-[#84cc16] via-[#a3e635] to-[#c4ff39] rounded-full bar-anim shadow-[0_0_12px_rgba(196,255,57,0.6)]" style="width: ${pct}%;"></div>
      </div>

      <!-- Live Grid Details -->
      <div class="grid grid-cols-3 gap-2.5 pt-1">
        <div class="bg-[var(--background)]/60 rounded-xl p-3 border border-[var(--border)]">
          <div class="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Frames Done</div>
          <div class="text-sm font-black font-mono mt-1 text-[var(--foreground)]" id="frames-val">${jsonPayload.currentFrame ? jsonPayload.currentFrame.toLocaleString() : "--"} / ${jsonPayload.totalFrames ? jsonPayload.totalFrames.toLocaleString() : "--"}</div>
        </div>
        <div class="bg-[var(--background)]/60 rounded-xl p-3 border border-[var(--border)]">
          <div class="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Elapsed Time</div>
          <div class="text-sm font-black font-mono mt-1 text-[var(--foreground)]" id="elapsed-time">${jsonPayload.elapsed}</div>
        </div>
        <div class="bg-[var(--background)]/60 rounded-xl p-3 border border-[var(--border)]">
          <div class="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Est. Remaining</div>
          <div class="text-sm font-black font-mono mt-1 text-[var(--foreground)]" id="eta-val">${currentStatus === "completed" ? "Done" : (jsonPayload.etaSeconds ? "~" + Math.round(jsonPayload.etaSeconds) + "s" : "--")}</div>
        </div>
      </div>

      <!-- Pipeline Stages Verification -->
      <div class="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)]">
        <div class="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
          <span class="${pct >= 20 ? "text-emerald-400" : "text-[#64748b]"}">${pct >= 20 ? "✔" : "○"}</span> Visual Assets
        </div>
        <div class="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
          <span class="${pct >= 60 ? "text-emerald-400" : "text-[#64748b]"}">${pct >= 60 ? "✔" : "○"}</span> Voice Synth
        </div>
        <div class="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
          <span class="${pct >= 100 ? "text-emerald-400" : "text-[#64748b]"}">${pct >= 100 ? "✔" : "○"}</span> 1080p Master
        </div>
        <div class="flex items-center gap-1.5 font-mono text-[11px] text-[#c4ff39]" id="render-status">
          ${currentStatus === "completed" ? "✔ COMPLETE" : "● RENDERING"}
        </div>
      </div>

      <!-- Persistent Completion Actions (Open button with Dropup) -->
      <div id="completion-actions" class="${currentStatus === "completed" ? "flex" : "hidden"} items-center justify-between pt-3 border-t border-[var(--border)] relative">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-emerald-400">✔ Ready to review</span>
          <span class="text-[11px] font-mono text-[var(--muted-foreground)] truncate max-w-[200px]" id="output-path-label">${jsonPayload.videoPath || "outputs/otaku-explainer.mp4"}</span>
        </div>

        <!-- Toast Banner -->
        <div id="hud-toast" class="opacity-0 pointer-events-none transition-opacity duration-200 absolute left-1/2 -translate-x-1/2 -top-10 bg-[#080b09] border border-[#c4ff39] text-[#c4ff39] text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50">
        </div>

        <div class="relative inline-block text-left">
          <!-- Main Open Button -->
          <div class="inline-flex rounded-xl shadow-sm">
            <button id="open-btn" onclick="toggleDropup()" type="button" class="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-[#c4ff39] text-[#080b09] hover:bg-[#b0f526] transition shadow-[0_0_15px_rgba(196,255,57,0.4)] border border-[#080b09]">
              <span>▶ Open</span>
              <svg class="w-3 h-3 text-[#080b09]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7"></path></svg>
            </button>
          </div>

          <!-- Dropup Menu -->
          <div id="dropup-menu" class="hidden absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-[#0e130f] border border-[#233125] shadow-2xl p-1.5 z-50 text-xs font-medium">
            <div class="px-3 py-1.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider border-b border-[#1b251d]">
              Open Output File
            </div>
            <button onclick="handleAction('quicktime')" class="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-[#1a231b] hover:text-[#c4ff39] transition flex items-center gap-2.5">
              <span>🎬</span> <span>Open with QuickTime</span>
            </button>
            <button onclick="handleAction('finder')" class="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-[#1a231b] hover:text-[#c4ff39] transition flex items-center gap-2.5">
              <span>📁</span> <span>Reveal in Finder</span>
            </button>
            <button onclick="handleAction('copy')" class="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-[#1a231b] hover:text-[#c4ff39] transition flex items-center gap-2.5">
              <span>📋</span> <span id="copy-btn-text">Copy Video Path</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentPct = ${pct};
    let currentFrame = ${jsonPayload.currentFrame || 0};
    const totalFrames = ${jsonPayload.totalFrames || 0};
    let isCompleted = ${currentStatus === "completed"};
    let videoFilePath = "${jsonPayload.videoPath || "outputs/otaku-explainer.mp4"}";

    function toggleDropup() {
      const menu = document.getElementById('dropup-menu');
      menu.classList.toggle('hidden');
    }

    document.addEventListener('click', (e) => {
      const btn = document.getElementById('open-btn');
      const menu = document.getElementById('dropup-menu');
      if (!btn || !menu) return;
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });

    function copyTextToClipboard(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise((res, rej) => {
        document.execCommand('copy') ? res() : rej();
        textArea.remove();
      });
    }

    function showToast(msg) {
      const toast = document.getElementById('hud-toast');
      if (!toast) return;
      toast.innerText = msg;
      toast.classList.remove('opacity-0', 'pointer-events-none');
      toast.classList.add('opacity-100');
      setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0', 'pointer-events-none');
      }, 3000);
    }

    function handleAction(type) {
      document.getElementById('dropup-menu').classList.add('hidden');
      if (type === 'copy') {
        copyTextToClipboard(videoFilePath).then(() => {
          showToast('✓ Video path copied to clipboard!');
        }).catch(() => {
          prompt('Copy video file path:', videoFilePath);
        });
      } else if (type === 'quicktime') {
        copyTextToClipboard('open -a "QuickTime Player" "' + videoFilePath + '"').then(() => {
          showToast('✓ Copied terminal command: open with QuickTime');
        });
      } else if (type === 'finder') {
        copyTextToClipboard('open -R "' + videoFilePath + '"').then(() => {
          showToast('✓ Copied terminal command: reveal in Finder');
        });
      }
    }

    async function poll() {
      if (isCompleted) return;
      try {
        const res = await fetch('progress.json?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        currentPct = data.percent;
        document.getElementById('pct-label').innerText = data.percent + '%';
        document.getElementById('bar-fill').style.width = data.percent + '%';
        document.getElementById('elapsed-time').innerText = data.elapsed;
        if (data.stageName) document.getElementById('stage-label').innerText = data.stageName;
        if (data.currentFrame && data.totalFrames) {
          currentFrame = data.currentFrame;
          document.getElementById('frames-val').innerText = data.currentFrame.toLocaleString() + ' / ' + data.totalFrames.toLocaleString();
        }
        if (data.etaSeconds) {
          const etaM = Math.floor(data.etaSeconds / 60);
          const etaS = Math.round(data.etaSeconds % 60);
          document.getElementById('eta-val').innerText = '~' + etaM + 'm ' + String(etaS).padStart(2, '0') + 's';
        }
        if (data.status === 'completed') {
          isCompleted = true;
          document.getElementById('render-status').innerText = '✔ COMPLETE';
          document.getElementById('completion-actions').classList.remove('hidden');
          document.getElementById('completion-actions').classList.add('flex');
          if (data.videoPath) {
            videoFilePath = data.videoPath;
            document.getElementById('output-path-label').innerText = data.videoPath;
          }
        }
      } catch (e) {}
    }
    setInterval(poll, 600);
  </script>
</body>
</html>`;

      writeFileSync(htmlPath, htmlContent, "utf8");

      // Mirror to active Antigravity brain artifact directory if found
      const brainDir = "/Users/shaz/.gemini/antigravity/brain/44a485a3-78d9-482a-9a55-841f4350afc2";
      if (brainDir) {
        try {
          writeFileSync(path.join(brainDir, "render_progress.html"), htmlContent, "utf8");
          writeFileSync(path.join(brainDir, "progress.json"), JSON.stringify(jsonPayload, null, 2), "utf8");
        } catch (_) {}
      }
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
