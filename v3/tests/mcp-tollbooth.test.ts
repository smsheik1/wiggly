import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WigglyMCPServer } from '../features/mcp/server';
import { JobStore } from '../features/mcp/job-store';

test('MCP Handshake and Tool Discovery', async () => {
  const store = new JobStore();
  const server = new WigglyMCPServer(store);

  // 1. Initialize
  const initRes = await server.handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'claude-desktop', version: '0.1.0' },
    },
  });

  assert.equal(initRes?.id, 1);
  assert.equal(initRes?.result?.serverInfo?.name, 'wiggly-tollbooth');
  assert.equal(initRes?.result?.protocolVersion, '2024-11-05');
  assert.ok(initRes?.result?.capabilities?.tools);

  // 2. Ping
  const pingRes = await server.handleMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'ping',
  });
  assert.equal(pingRes?.id, 2);
  assert.deepEqual(pingRes?.result, {});

  // 3. Tools List
  const listRes = await server.handleMessage({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/list',
  });

  const tools = listRes?.result?.tools ?? [];
  assert.equal(tools.length, 3);

  const toolNames = tools.map((t: any) => t.name);
  assert.ok(toolNames.includes('wiggly_submit_film'));
  assert.ok(toolNames.includes('wiggly_get_film'));
  assert.ok(toolNames.includes('wiggly_finalize_film'));

  const submitTool = tools.find((t: any) => t.name === 'wiggly_submit_film');
  assert.ok(submitTool.inputSchema.required.includes('idempotencyKey'));
  assert.ok(submitTool.inputSchema.required.includes('storyboard'));
});

test('wiggly_submit_film creates job and enforces idempotency', async () => {
  const store = new JobStore();
  const server = new WigglyMCPServer(store);

  const validPayload = {
    idempotencyKey: 'idemp_key_test_12345678',
    storyboard: {
      title: 'Shaz and Mia',
      subject: 'Mia',
      beats: [
        {
          beatId: 1,
          durationSec: 10,
          action: 'Young father holds his baby girl on front porch at sunset',
          camera: 'Medium slow track, 16:9 widescreen',
          narrationLine: 'I never knew where this road would take us...',
          foleyDescription: 'soft evening wind, gentle crickets',
        },
        {
          beatId: 2,
          durationSec: 12,
          action: 'Teenager sits in a beat up 2000 Honda Accord looking out at the city lights',
          camera: 'Interior profile camera, dashboard glow',
          narrationLine: 'Driving late at night, dreaming of tomorrow.',
          foleyDescription: 'low car engine rumble',
        },
      ],
      characters: [
        {
          tag: '@Shaz_Adult',
          name: 'Shaz',
          ageOrStage: '34-year-old father',
          referencePhotoUrls: ['https://cdn.wiggly.com/photos/shaz-adult.jpg'],
        },
      ],
      heroProps: [
        {
          tag: '@2000_Honda_Accord',
          name: '2000 Honda Accord Coupe',
          description: 'Silver 2-door coupe with slightly faded paint',
          referencePhotoUrls: ['https://cdn.wiggly.com/photos/honda.jpg'],
        },
      ],
    },
    voiceover: {
      type: 'parent_clone' as const,
      voiceSampleUrl: 'https://cdn.wiggly.com/audio/sample.mp3',
    },
  };

  // Submit first time
  const submitRes1 = await server.handleMessage({
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: {
      name: 'wiggly_submit_film',
      arguments: validPayload,
    },
  });

  assert.equal(submitRes1?.id, 10);
  assert.ok(!submitRes1?.error);
  const data1 = JSON.parse(submitRes1?.result?.content[0]?.text);
  assert.ok(data1.jobId.startsWith('film_'));
  assert.equal(data1.status, 'queued');

  // Submit second time with identical idempotencyKey
  const submitRes2 = await server.handleMessage({
    jsonrpc: '2.0',
    id: 11,
    method: 'tools/call',
    params: {
      name: 'wiggly_submit_film',
      arguments: validPayload,
    },
  });

  const data2 = JSON.parse(submitRes2?.result?.content[0]?.text);
  assert.equal(data2.jobId, data1.jobId, 'Idempotent call must return the exact same jobId');
});

test('wiggly_get_film returns status, progress, and retryAfterSec', async () => {
  const store = new JobStore();
  const server = new WigglyMCPServer(store);

  const submitRes = await server.callTool('wiggly_submit_film', {
    idempotencyKey: 'idemp_key_status_check_1',
    storyboard: {
      title: 'Family Story',
      subject: 'Dad',
      beats: [
        {
          beatId: 1,
          durationSec: 10,
          action: 'Dad laughing with daughter',
          camera: 'Close up',
        },
      ],
      characters: [
        {
          tag: '@Dad',
          name: 'Dad',
          ageOrStage: '40-year-old',
          referencePhotoUrls: ['https://cdn.wiggly.com/dad.jpg'],
        },
      ],
    },
  });

  const jobId = submitRes.jobId;

  // Poll job
  const pollRes = await server.handleMessage({
    jsonrpc: '2.0',
    id: 20,
    method: 'tools/call',
    params: {
      name: 'wiggly_get_film',
      arguments: { jobId },
    },
  });

  assert.equal(pollRes?.id, 20);
  const pollData = JSON.parse(pollRes?.result?.content[0]?.text);
  assert.equal(pollData.jobId, jobId);
  assert.equal(pollData.status, 'queued');
  assert.equal(pollData.retryAfterSec, 15, 'Must return retryAfterSec: 15 to prevent poll spam');
  assert.equal(pollData.rerollBudgetRemaining, 3);
});

test('wiggly_finalize_film handles 1080p master order and reroll allowances', async () => {
  const store = new JobStore();
  const server = new WigglyMCPServer(store);

  const submitRes = await server.callTool('wiggly_submit_film', {
    idempotencyKey: 'idemp_key_finalize_check_1',
    storyboard: {
      title: 'Our Journey',
      subject: 'Grandma',
      beats: [
        {
          beatId: 1,
          durationSec: 8,
          action: 'Grandma gardening in the backyard',
          camera: 'Wide shot',
        },
      ],
      characters: [
        {
          tag: '@Grandma',
          name: 'Grandma',
          ageOrStage: '70-year-old',
          referencePhotoUrls: ['https://cdn.wiggly.com/grandma.jpg'],
        },
      ],
    },
  });

  const jobId = submitRes.jobId;

  // 1. Reroll shot 1
  const rerollRes = await server.handleMessage({
    jsonrpc: '2.0',
    id: 30,
    method: 'tools/call',
    params: {
      name: 'wiggly_finalize_film',
      arguments: {
        jobId,
        action: 'reroll_shot',
        rerollShotId: 1,
        rerollNotes: 'Hand on watering can had 6 fingers; adjust prompt pose',
      },
    },
  });

  assert.equal(rerollRes?.id, 30);
  const rerollData = JSON.parse(rerollRes?.result?.content[0]?.text);
  assert.equal(rerollData.status, 'rerolling');

  // Check budget deducted
  const jobStateAfterReroll = await store.getFilm(jobId);
  assert.equal(jobStateAfterReroll.rerollBudgetRemaining, 2);

  // 2. Attempting a second reroll on the same shot should be rejected (max 1 reroll per shot)
  const secondRerollRes = await server.handleMessage({
    jsonrpc: '2.0',
    id: 31,
    method: 'tools/call',
    params: {
      name: 'wiggly_finalize_film',
      arguments: {
        jobId,
        action: 'reroll_shot',
        rerollShotId: 1,
      },
    },
  });

  assert.ok(secondRerollRes?.error);
  assert.match(secondRerollRes.error.message, /maximum allowed free reroll limit/);

  // 3. Confirm 1080p Master Order
  const finalizeRes = await server.handleMessage({
    jsonrpc: '2.0',
    id: 32,
    method: 'tools/call',
    params: {
      name: 'wiggly_finalize_film',
      arguments: {
        jobId,
        action: 'order_1080p_master',
      },
    },
  });

  assert.equal(finalizeRes?.id, 32);
  const finalizeData = JSON.parse(finalizeRes?.result?.content[0]?.text);
  assert.equal(finalizeData.status, 'master_ordered');
  assert.equal(finalizeData.currentStage, 'upscaling_1080p');
});

test('Error handling for invalid arguments and missing jobId', async () => {
  const store = new JobStore();
  const server = new WigglyMCPServer(store);

  // Missing required idempotencyKey
  const badSubmit = await server.handleMessage({
    jsonrpc: '2.0',
    id: 40,
    method: 'tools/call',
    params: {
      name: 'wiggly_submit_film',
      arguments: {
        storyboard: {},
      },
    },
  });
  assert.ok(badSubmit?.error);
  assert.match(badSubmit.error.message, /Invalid arguments/);

  // Unknown jobId
  const badGet = await server.handleMessage({
    jsonrpc: '2.0',
    id: 41,
    method: 'tools/call',
    params: {
      name: 'wiggly_get_film',
      arguments: {
        jobId: 'non_existent_job_123',
      },
    },
  });
  assert.ok(badGet?.error);
  assert.match(badGet.error.message, /Job not found/);
});
