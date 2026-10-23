import { SubmitFilmInputSchema, GetFilmInputSchema, FinalizeFilmInputSchema } from './schema';
import { JobStore, defaultJobStore } from './job-store';

export const PROTOCOL_VERSION = '2024-11-05';
export const SERVER_NAME = 'wiggly-tollbooth';
export const SERVER_VERSION = '1.0.0';

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class WigglyMCPServer {
  private jobStore: JobStore;

  constructor(jobStore: JobStore = defaultJobStore) {
    this.jobStore = jobStore;
  }

  /**
   * Returns tool definitions compliant with MCP specification.
   */
  getToolsList() {
    return [
      {
        name: 'wiggly_submit_film',
        description: 'Submits a 7-beat My Pixar Story screenplay and character reference photos to Wiggly for 720p draft rendering, 4K character lineup generation, and 3x3 dailies contact sheet creation. Returns a durable jobId immediately (<500ms). Idempotent.',
        inputSchema: {
          type: 'object',
          properties: {
            idempotencyKey: {
              type: 'string',
              description: 'Client-generated unique key (UUID/hash) preventing duplicate billing on retries',
            },
            storyboard: {
              type: 'object',
              description: 'The 7-beat screenplay, character cast with photo URLs, and optional hero props',
              required: ['title', 'subject', 'beats', 'characters'],
              properties: {
                title: { type: 'string' },
                subject: { type: 'string' },
                beats: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['beatId', 'durationSec', 'action', 'camera'],
                    properties: {
                      beatId: { type: 'number' },
                      durationSec: { type: 'number' },
                      action: { type: 'string' },
                      camera: { type: 'string' },
                      narrationLine: { type: 'string' },
                      foleyDescription: { type: 'string' },
                    },
                  },
                },
                characters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['tag', 'name', 'ageOrStage', 'referencePhotoUrls'],
                    properties: {
                      tag: { type: 'string' },
                      name: { type: 'string' },
                      ageOrStage: { type: 'string' },
                      referencePhotoUrls: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Family photo URLs for consistent facial likeness',
                      },
                    },
                  },
                },
                heroProps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['tag', 'name', 'description'],
                    properties: {
                      tag: { type: 'string' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      referencePhotoUrls: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
            voiceover: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['parent_clone', 'studio_narrator'] },
                voiceSampleUrl: { type: 'string' },
              },
            },
            tier: {
              type: 'string',
              enum: ['standard_preview', 'theatrical_1080p'],
              default: 'standard_preview',
            },
          },
          required: ['idempotencyKey', 'storyboard'],
        },
      },
      {
        name: 'wiggly_get_film',
        description: 'Polls the status of a film generation job. Returns current progress, active pipeline stage, retryAfterSec (default 15s to prevent poll-spam), draft preview URLs, and contact sheet.',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'The unique film job ID returned by wiggly_submit_film',
            },
          },
          required: ['jobId'],
        },
      },
      {
        name: 'wiggly_finalize_film',
        description: 'Human approval gate. Dispatches either a single-shot reroll (if an artifact/defect was identified in review) or triggers the final 1080p theatrical master upscale pass on Replicate.',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'The unique film job ID returned by wiggly_submit_film',
            },
            action: {
              type: 'string',
              enum: ['reroll_shot', 'order_1080p_master'],
              description: 'Action to take: reroll a defective shot or order the 1080p master',
            },
            rerollShotId: {
              type: 'number',
              description: 'The beatId/shotId to reroll (required when action is reroll_shot)',
            },
            rerollNotes: {
              type: 'string',
              description: 'Optional director notes detailing the specific adjustment or defect',
            },
          },
          required: ['jobId', 'action'],
        },
      },
    ];
  }

  /**
   * Executes a named tool call with argument validation.
   */
  async callTool(name: string, args: any) {
    switch (name) {
      case 'wiggly_submit_film': {
        const parsed = SubmitFilmInputSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for wiggly_submit_film: ${parsed.error.message}`);
        }
        return await this.jobStore.submitFilm(parsed.data);
      }
      case 'wiggly_get_film': {
        const parsed = GetFilmInputSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for wiggly_get_film: ${parsed.error.message}`);
        }
        return await this.jobStore.getFilm(parsed.data.jobId);
      }
      case 'wiggly_finalize_film': {
        const parsed = FinalizeFilmInputSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for wiggly_finalize_film: ${parsed.error.message}`);
        }
        return await this.jobStore.finalizeFilm(parsed.data);
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Dispatches an incoming JSON-RPC 2.0 message and returns the response object (if not a notification).
   */
  async handleMessage(req: JSONRPCRequest): Promise<JSONRPCResponse | null> {
    const id = req.id !== undefined ? req.id : null;

    try {
      if (req.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION,
            },
          },
        };
      }

      if (req.method === 'notifications/initialized') {
        // Notification - no response required
        return null;
      }

      if (req.method === 'ping') {
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };
      }

      if (req.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: this.getToolsList(),
          },
        };
      }

      if (req.method === 'tools/call') {
        const toolName = req.params?.name;
        const toolArgs = req.params?.arguments ?? {};
        const res = await this.callTool(toolName, toolArgs);

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(res, null, 2),
              },
            ],
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${req.method}`,
        },
      };
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message || 'Internal error',
        },
      };
    }
  }
}
