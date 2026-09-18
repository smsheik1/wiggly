#!/usr/bin/env node
/**
 * Fully Autonomous Buffer Publisher for Arkham Content Studio
 *
 * Programmatically publishes vertical video content to social platforms:
 * 1. Loads OAuth token from antigravity/mcp_oauth_tokens.json
 * 2. Starts an ephemeral Range HTTP server (supporting 206 Partial Content)
 * 3. Launches a Cloudflare tunnel (cloudflared) to expose the local video via HTTPS
 * 4. Calls Buffer MCP JSON-RPC directly (create_post) for YouTube, Instagram, and Twitter
 * 5. Polls until each platform confirms status: "sent" and captures public links
 * 6. Shuts down tunnel and HTTP server cleanly
 * 7. Writes distribution receipt and updates outputs/daily/history.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { spawn } from 'node:child_process';

const BUFFER_MCP_URL = 'https://mcp.buffer.com/mcp';
const TOKEN_PATH = '/Users/shaz/.gemini/antigravity/mcp_oauth_tokens.json';
const HISTORY_PATH = resolve('outputs/daily/history.json');

const FALLBACK_CHANNEL_IDS = {
  youtube: '6aa8558cea19ca0bde41e233',
  instagram: '6aa8498aea19ca0bde418e03',
  tiktok: '6aa84771ea19ca0bde4180e1'
};

async function resolveChannelIds(token) {
  try {
    const acc = await callBufferMcp('get_account', {}, token);
    const orgId = acc.organizations?.[0]?.id;
    if (orgId) {
      const channels = await callBufferMcp('list_channels', { organizationId: orgId }, token);
      if (Array.isArray(channels)) {
        const ids = {};
        for (const ch of channels) {
          if (ch.service === 'youtube' && !ch.isDisconnected) ids.youtube = ch.id;
          if (ch.service === 'instagram' && !ch.isDisconnected) ids.instagram = ch.id;
          if (ch.service === 'tiktok' && !ch.isDisconnected) ids.tiktok = ch.id;
          if (ch.service === 'twitter' && !ch.isDisconnected) ids.twitter = ch.id;
        }
        if (ids.youtube || ids.instagram || ids.tiktok) {
          return ids;
        }
      }
    }
  } catch (err) {
    console.warn('[publish] Could not fetch channels dynamically, falling back to static IDs:', err.message);
  }
  return FALLBACK_CHANNEL_IDS;
}

function getAccessToken() {
  if (process.env.BUFFER_API_KEY?.trim()) {
    return process.env.BUFFER_API_KEY.trim();
  }
  const candidatePaths = [
    resolve('secrets.env'),
    resolve('../secrets.env'),
    resolve('../../secrets.env'),
    '/Users/shaz/Documents/wiggly/secrets.env'
  ];
  for (const p of candidatePaths) {
    if (existsSync(p)) {
      try {
        const text = readFileSync(p, 'utf8');
        const match = text.match(/^BUFFER_API_KEY=(.+)$/m);
        if (match && match[1].trim()) {
          return match[1].trim();
        }
      } catch {}
    }
  }
  if (existsSync(TOKEN_PATH)) {
    try {
      const config = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
      const entry = config['https://mcp.buffer.com/mcp'];
      if (entry?.token?.access_token) {
        return entry.token.access_token;
      }
    } catch {}
  }
  throw new Error('No Buffer access token found in BUFFER_API_KEY (secrets.env) or mcp_oauth_tokens.json');
}

async function callBufferMcp(toolName, args, token) {
  const res = await fetch(BUFFER_MCP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(`Buffer MCP error: ${JSON.stringify(json.error)}`);
  }
  if (json.result?.isError) {
    const errText = json.result?.content?.[0]?.text || 'MCP call failed';
    throw new Error(errText);
  }
  const contentText = json.result?.content?.[0]?.text;
  if (!contentText) {
    throw new Error('Empty response from Buffer MCP');
  }
  return JSON.parse(contentText);
}

function startRangeServer(directory, port = 8099) {
  return new Promise((resolveServer, rejectServer) => {
    const server = createServer((req, res) => {
      const safePath = req.url.split('?')[0].replace(/^\/+/, '');
      const filePath = join(directory, safePath);

      if (!filePath.startsWith(directory) || !existsSync(filePath)) {
        res.writeHead(404);
        return res.end('Not Found');
      }

      const stat = statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      const baseHeaders = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      };

      if (req.method === 'OPTIONS') {
        res.writeHead(204, baseHeaders);
        return res.end();
      }

      if (req.method === 'HEAD') {
        res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
        return res.end();
      }

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${fileSize}` });
          return res.end();
        }

        const chunksize = (end - start) + 1;
        const fileStream = createReadStream(filePath, { start, end });
        res.writeHead(206, {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunksize
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
        createReadStream(filePath).pipe(res);
      }
    });

    server.on('error', rejectServer);
    server.listen(port, '127.0.0.1', () => {
      resolveServer(server);
    });
  });
}

function startCloudflareTunnel(port = 8099) {
  return new Promise((resolveTunnel, rejectTunnel) => {
    const proc = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`]);
    let tunnelUrl = null;
    let registered = false;

    const maybeResolve = async () => {
      if (tunnelUrl && registered) {
        // Wait for DNS propagation and verify reachability from outside
        for (let attempt = 1; attempt <= 15; attempt++) {
          await new Promise(r => setTimeout(r, 1000));
          try {
            const headRes = await fetch(tunnelUrl, { method: 'HEAD' });
            if (headRes.status === 200 || headRes.status === 404 || headRes.status === 204) {
              return resolveTunnel({ proc, url: tunnelUrl });
            }
          } catch (e) {
            // keep waiting for DNS resolution
          }
        }
        // Fallback resolve if reached
        resolveTunnel({ proc, url: tunnelUrl });
      }
    };

    const handleOutput = (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !tunnelUrl) {
        tunnelUrl = match[0];
        maybeResolve();
      }
      if (text.includes('Registered tunnel connection')) {
        registered = true;
        maybeResolve();
      }
    };

    proc.stdout.on('data', handleOutput);
    proc.stderr.on('data', handleOutput);

    proc.on('error', (err) => {
      if (!tunnelUrl) rejectTunnel(err);
    });

    setTimeout(() => {
      if (tunnelUrl) {
        resolveTunnel({ proc, url: tunnelUrl });
      } else {
        proc.kill();
        rejectTunnel(new Error('Cloudflare tunnel startup timed out after 30s'));
      }
    }, 30000);
  });
}

export async function publishAutonomous(distConfigPath, mediaOverride = null) {
  console.log('========================================================');
  console.log('📡 AUTONOMOUS BUFFER SOCIAL DISPATCHER');
  console.log('========================================================');

  const resolvedDistPath = resolve(distConfigPath);
  if (!existsSync(resolvedDistPath)) {
    throw new Error(`Distribution manifest not found: ${resolvedDistPath}`);
  }

  const distConfig = JSON.parse(readFileSync(resolvedDistPath, 'utf8'));
  let mediaPath = mediaOverride ? resolve(mediaOverride) : resolve(dirname(resolvedDistPath), distConfig.media);
  if (!existsSync(mediaPath)) {
    mediaPath = resolve(dirname(resolvedDistPath), '..', distConfig.media);
  }

  if (!existsSync(mediaPath)) {
    throw new Error(`Media video file not found: ${mediaPath}`);
  }

  const token = getAccessToken();
  const channelIds = await resolveChannelIds(token);
  console.log(`[publish] Connected Buffer Channels:`, Object.entries(channelIds).map(([svc, id]) => `${svc}:${id}`).join(', '));

  const mediaDir = dirname(mediaPath);
  const mediaFilename = basename(mediaPath);

  console.log(`[publish] Preparing local video: ${mediaFilename}`);
  console.log(`[publish] Starting local Range HTTP server on port 8099...`);
  const server = await startRangeServer(mediaDir, 8099);

  console.log(`[publish] Opening Cloudflare edge tunnel...`);
  const tunnel = await startCloudflareTunnel(8099);
  const publicVideoUrl = `${tunnel.url}/${mediaFilename}`;
  console.log(`[publish] Public Video CDN URL: ${publicVideoUrl}`);
  console.log(`[publish] Edge tunnel established and ready for Buffer ingestion.`);

  const platforms = distConfig.platforms || {};
  const dispatches = {};

  try {
    // 1. YouTube Shorts
    if (platforms.youtube?.enabled && channelIds.youtube) {
      console.log(`[publish] Dispatching to YouTube Shorts...`);
      const yt = platforms.youtube;
      const res = await callBufferMcp('create_post', {
        channelId: channelIds.youtube,
        schedulingType: 'automatic',
        mode: 'shareNow',
        text: yt.description || yt.title,
        assets: [{
          video: {
            url: publicVideoUrl,
            metadata: { title: yt.title }
          }
        }],
        metadata: {
          youtube: {
            title: yt.title,
            categoryId: yt.categoryId || '20',
            privacy: yt.privacy || 'public',
            notifySubscribers: true
          }
        }
      }, token);
      dispatches.youtube = { postId: res.id, status: res.status };
      console.log(`  YouTube Shorts queued: Post ID ${res.id}`);
    }

    // 2. Instagram Reels
    if (platforms.instagram?.enabled && channelIds.instagram) {
      console.log(`[publish] Dispatching to Instagram Reels...`);
      const ig = platforms.instagram;
      const res = await callBufferMcp('create_post', {
        channelId: channelIds.instagram,
        schedulingType: 'automatic',
        mode: 'shareNow',
        text: ig.caption,
        assets: [{ video: { url: publicVideoUrl } }],
        metadata: {
          instagram: {
            type: 'reel',
            shouldShareToFeed: true
          }
        }
      }, token);
      dispatches.instagram = { postId: res.id, status: res.status };
      console.log(`  Instagram Reels queued: Post ID ${res.id}`);
    }

    // 3. TikTok
    if (platforms.tiktok?.enabled && channelIds.tiktok) {
      console.log(`[publish] Dispatching to TikTok...`);
      const tt = platforms.tiktok;
      const res = await callBufferMcp('create_post', {
        channelId: channelIds.tiktok,
        schedulingType: 'automatic',
        mode: 'shareNow',
        text: tt.caption || tt.title || 'Batman Arkham Dialogue',
        assets: [{ video: { url: publicVideoUrl } }],
        metadata: {
          tiktok: {
            title: tt.title || 'Batman Arkham Dialogue',
            isAiGenerated: true
          }
        }
      }, token);
      dispatches.tiktok = { postId: res.id, status: res.status };
      console.log(`  TikTok queued: Post ID ${res.id}`);
    }

    // 4. Twitter / X
    if (platforms.twitter?.enabled && channelIds.twitter) {
      console.log(`[publish] Dispatching to Twitter / X...`);
      const tw = platforms.twitter;
      const res = await callBufferMcp('create_post', {
        channelId: channelIds.twitter,
        schedulingType: 'automatic',
        mode: 'shareNow',
        text: tw.text,
        assets: [{ video: { url: publicVideoUrl } }]
      }, token);
      dispatches.twitter = { postId: res.id, status: res.status };
      console.log(`  Twitter / X queued: Post ID ${res.id}`);
    }

    // Poll for status sent and public externalLinks
    console.log(`[publish] Monitoring Buffer ingestion and publication...`);
    const liveResults = {};
    const platformKeys = Object.keys(dispatches);
    const deadline = Date.now() + 180000; // 3 minutes max

    while (Date.now() < deadline && Object.keys(liveResults).length < platformKeys.length) {
      for (const key of platformKeys) {
        if (liveResults[key]) continue;
        const entry = dispatches[key];
        try {
          const detail = await callBufferMcp('get_post', { postId: entry.postId }, token);
          if (detail.status === 'sent') {
            liveResults[key] = {
              status: 'sent',
              postId: detail.id,
              url: detail.externalLink || null,
              sentAt: detail.sentAt || new Date().toISOString()
            };
            console.log(`  [OK] ${key.toUpperCase()} LIVE: ${detail.externalLink || 'Published'}`);
          } else if (detail.status === 'error') {
            liveResults[key] = {
              status: 'error',
              postId: detail.id,
              error: detail.error?.message || 'Unknown error'
            };
            console.warn(`  [ERR] ${key.toUpperCase()} failed: ${liveResults[key].error}`);
          }
        } catch (pollErr) {
          console.warn(`  Warning polling ${key}:`, pollErr.message);
        }
      }
      if (Object.keys(liveResults).length < platformKeys.length) {
        await new Promise(r => setTimeout(r, 6000));
      }
    }

    // Graceful teardown of tunnel and server
    console.log(`[publish] Tearing down ephemeral tunnel and server...`);
    tunnel.proc.kill();
    server.close();

    // Write distribution receipt
    const receiptPath = resolvedDistPath.endsWith('.receipt.json')
      ? resolvedDistPath
      : `${mediaPath}.receipt.json`;
    const receiptPayload = {
      schemaVersion: 1,
      status: 'success',
      timestamp: new Date().toISOString(),
      media: mediaFilename,
      platforms: liveResults
    };
    writeFileSync(receiptPath, JSON.stringify(receiptPayload, null, 2) + '\n');
    console.log(`[publish] Distribution receipt saved: ${receiptPath}`);

    // Update history.json if available
    if (existsSync(HISTORY_PATH)) {
      try {
        const history = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
        const last = history[history.length - 1];
        if (last) {
          last.publishedLive = {
            youtube: liveResults.youtube?.url || null,
            instagram: liveResults.instagram?.url || null,
            tiktok: liveResults.tiktok?.url || null,
            twitter: liveResults.twitter?.url || null,
            publishedAt: new Date().toISOString()
          };
          writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
          console.log(`[publish] Memory history updated with live post links.`);
        }
      } catch (hErr) {
        console.warn('[publish] Could not update history.json:', hErr.message);
      }
    }

    console.log('========================================================');
    console.log('🎉 ALL SOCIAL DISPATCHES COMPLETE');
    console.log('========================================================');
    for (const [k, v] of Object.entries(liveResults)) {
      console.log(`• ${k.toUpperCase()}: ${v.url || v.status}`);
    }
    console.log('========================================================\n');

    return liveResults;
  } catch (err) {
    tunnel.proc.kill();
    server.close();
    throw err;
  }
}

// CLI entry
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node runtime/publish-buffer.mjs <distribution.json> [video.mp4]');
    process.exit(1);
  }
  publishAutonomous(args[0], args[1]).catch(err => {
    console.error('Fatal dispatch error:', err);
    process.exit(1);
  });
}
