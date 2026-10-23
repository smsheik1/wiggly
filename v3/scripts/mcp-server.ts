#!/usr/bin/env node
import * as readline from 'node:readline';
import { WigglyMCPServer } from '../features/mcp/server';

const server = new WigglyMCPServer();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const req = JSON.parse(trimmed);
    const res = await server.handleMessage(req);
    if (res !== null) {
      process.stdout.write(JSON.stringify(res) + '\n');
    }
  } catch (err: any) {
    process.stderr.write(`[wiggly-mcp] Error processing request: ${err.message}\n`);
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
      },
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

process.stderr.write('[wiggly-mcp] Tollbooth server started on stdio.\n');
