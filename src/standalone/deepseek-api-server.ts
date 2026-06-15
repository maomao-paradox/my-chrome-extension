import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

import {
    DeepSeekClient,
    DEFAULT_DEEPSEEK_API_BASE_URL,
    DEFAULT_DEEPSEEK_AUTH_TOKEN,
    DEFAULT_DEEPSEEK_COOKIES,
    DEFAULT_DEEPSEEK_SESSION_COOKIE,
    DEFAULT_DEEPSEEK_USER_AGENT,
    type DeepSeekPowChallenge,
    type DeepSeekPowSolver,
    type DeepSeekSessionStore,
    type SessionData,
} from '../shared/deepseek-core.js';

interface DeepSeekChatRequest {
    prompt?: string;
    role?: string;
    systemPrompt?: string;
    stream?: boolean;
}

interface PowAssetBundle {
    bundleUrl: string;
    wasmBytes: Uint8Array;
}

const DEFAULT_HOST = process.env.DEEPSEEK_SERVICE_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.DEEPSEEK_SERVICE_PORT || '8787');
const DEFAULT_SESSION_FILE = process.env.DEEPSEEK_SESSION_FILE || path.resolve(process.cwd(), '.deepseek-service', 'sessions.json');

const sharedCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

class JsonFileSessionStore implements DeepSeekSessionStore {
    private readonly filePath: string;
    private cache: Record<string, SessionData> | null = null;
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    async get(role: string): Promise<SessionData | null> {
        const allSessions = await this.loadAll();
        return allSessions[role] || null;
    }

    async set(role: string, sessionData: SessionData): Promise<void> {
        const allSessions = await this.loadAll();
        allSessions[role] = sessionData;
        await this.persist(allSessions);
    }

    async clear(role: string): Promise<void> {
        const allSessions = await this.loadAll();
        delete allSessions[role];
        await this.persist(allSessions);
    }

    private async loadAll(): Promise<Record<string, SessionData>> {
        if (this.cache) {
            return this.cache;
        }

        try {
            const fileContent = await readFile(this.filePath, 'utf8');
            this.cache = JSON.parse(fileContent) as Record<string, SessionData>;
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code !== 'ENOENT') {
                maLogger.warn('Failed to load session store, using empty state:', error);
            }
            this.cache = {};
        }

        return this.cache;
    }

    private async persist(allSessions: Record<string, SessionData>): Promise<void> {
        this.cache = allSessions;
        this.writeQueue = this.writeQueue.then(async () => {
            await mkdir(path.dirname(this.filePath), { recursive: true });
            await writeFile(this.filePath, JSON.stringify(allSessions, null, 2), 'utf8');
        });

        await this.writeQueue;
    }
}

class NodePowSolver implements DeepSeekPowSolver {
    private assetBundlePromise: Promise<PowAssetBundle> | null = null;

    async solve(challenge: DeepSeekPowChallenge): Promise<string> {
        const assetBundle = await this.resolveAssets();
        const normalizedChallenge = {
            ...challenge,
            expireAt: challenge.expireAt ?? challenge.expire_at
        };

        return new Promise((resolve, reject) => {
            const workerBootstrap = `
                const { parentPort } = require('node:worker_threads');

                globalThis.self = globalThis;
                globalThis.location = ${JSON.stringify(assetBundle.bundleUrl)};
                globalThis.self.location = globalThis.location;
                globalThis.onmessage = null;
                globalThis.postMessage = (message) => parentPort.postMessage(message);
                parentPort.on('message', (data) => {
                    if (globalThis.onmessage) {
                        globalThis.onmessage({ data });
                    }
                });

                import(${JSON.stringify(assetBundle.bundleUrl)})
                    .then(() => {
                        parentPort.postMessage({ type: 'ready' });
                    })
                    .catch((error) => {
                        parentPort.postMessage({ type: 'pow-error', error: error?.message || String(error) });
                    });
            `;

            const worker = new Worker(workerBootstrap, { eval: true });
            let settled = false;
            const timeout = setTimeout(() => {
                void settle(new Error('POW calculation timeout'));
            }, 30000);

            const settle = async (result: Error | string): Promise<void> => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                await worker.terminate().catch(() => undefined);

                if (result instanceof Error) {
                    reject(result);
                    return;
                }

                resolve(result);
            };

            worker.on('message', (message: unknown) => {
                const payload = message as Record<string, unknown> | null;
                if (!payload || typeof payload !== 'object') {
                    return;
                }

                if (payload.type === 'ready') {
                    worker.postMessage({
                        type: 'pow-challenge',
                        wasmUrl: assetBundle.wasmBytes,
                        challenge: normalizedChallenge
                    });
                    return;
                }

                if (payload.type === 'pow-answer') {
                    const answerPayload = payload.answer as Record<string, unknown> | undefined;
                    if (!answerPayload) {
                        void settle(new Error('POW worker returned an empty answer'));
                        return;
                    }

                    const powResponse = Buffer
                        .from(JSON.stringify({
                            ...answerPayload,
                            target_path: '/api/v0/chat/completion'
                        }), 'utf8')
                        .toString('base64');

                    void settle(powResponse);
                    return;
                }

                if (payload.type === 'pow-error') {
                    const message = typeof payload.error === 'string'
                        ? payload.error
                        : 'POW calculation failed';
                    void settle(new Error(message));
                }
            });

            worker.on('error', (error) => {
                void settle(error);
            });
        });
    }

    private async resolveAssets(): Promise<PowAssetBundle> {
        if (!this.assetBundlePromise) {
            this.assetBundlePromise = this.findPowAssets();
        }

        return this.assetBundlePromise;
    }

    private async findPowAssets(): Promise<PowAssetBundle> {
        const assetsDirectory = path.resolve(process.cwd(), 'public', 'static', 'js');
        const assetEntries = await readdir(assetsDirectory);

        const wasmFile = assetEntries.find((entry) => /^sha3_wasm_bg\..+\.wasm$/.test(entry));
        if (!wasmFile) {
            throw new Error(`Unable to locate DeepSeek POW wasm asset in ${assetsDirectory}`);
        }

        let workerBundlePath: string | null = null;
        for (const entry of assetEntries) {
            if (!entry.endsWith('.js')) {
                continue;
            }

            const absolutePath = path.join(assetsDirectory, entry);
            const source = await readFile(absolutePath, 'utf8');
            if (source.includes('pow-challenge') && source.includes('DeepSeekHashV1')) {
                workerBundlePath = absolutePath;
                break;
            }
        }

        if (!workerBundlePath) {
            throw new Error(`Unable to locate DeepSeek POW worker bundle in ${assetsDirectory}`);
        }

        const wasmBytes = new Uint8Array(await readFile(path.join(assetsDirectory, wasmFile)));
        return {
            bundleUrl: pathToFileURL(workerBundlePath).toString(),
            wasmBytes
        };
    }
}

function withCorsHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return {
        ...sharedCorsHeaders,
        ...headers
    };
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
    res.writeHead(statusCode, withCorsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
    res.end(JSON.stringify(payload));
}

function writeNotFound(res: ServerResponse): void {
    writeJson(res, 404, { error: 'Not found' });
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (chunks.length === 0) {
        return {} as T;
    }

    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

function validateChatRequest(body: DeepSeekChatRequest): Required<Pick<DeepSeekChatRequest, 'prompt' | 'role' | 'stream'>> & Pick<DeepSeekChatRequest, 'systemPrompt'> {
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
        throw new Error('`prompt` is required');
    }

    return {
        prompt,
        role: typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'default_ai_assistant',
        systemPrompt: typeof body.systemPrompt === 'string' ? body.systemPrompt : undefined,
        stream: body.stream !== false
    };
}

async function main(): Promise<void> {
    const deepSeekClient = new DeepSeekClient({
        sessionStore: new JsonFileSessionStore(DEFAULT_SESSION_FILE),
        powSolver: new NodePowSolver(),
        apiBaseUrl: process.env.DEEPSEEK_API_BASE_URL || DEFAULT_DEEPSEEK_API_BASE_URL,
        authToken: process.env.DEEPSEEK_AUTH_TOKEN || DEFAULT_DEEPSEEK_AUTH_TOKEN,
        cookies: process.env.DEEPSEEK_COOKIES || DEFAULT_DEEPSEEK_COOKIES,
        userAgent: process.env.DEEPSEEK_USER_AGENT || DEFAULT_DEEPSEEK_USER_AGENT,
        createSessionCookie: process.env.DEEPSEEK_CREATE_SESSION_COOKIE || DEFAULT_DEEPSEEK_SESSION_COOKIE
    });

    const server = createServer(async (req, res) => {
        try {
            if (!req.url || !req.method) {
                writeJson(res, 400, { error: 'Invalid request' });
                return;
            }

            const requestUrl = new URL(req.url, `http://${req.headers.host || `${DEFAULT_HOST}:${DEFAULT_PORT}`}`);

            if (req.method === 'OPTIONS') {
                res.writeHead(204, withCorsHeaders());
                res.end();
                return;
            }

            if (req.method === 'GET' && (requestUrl.pathname === '/health' || requestUrl.pathname === '/api/deepseek/health')) {
                writeJson(res, 200, {
                    ok: true,
                    service: 'deepseek-api',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            if (req.method === 'POST' && (requestUrl.pathname === '/api/deepseek/chat' || requestUrl.pathname === '/api/deepseek/chat/completions')) {
                const body = await readJsonBody<DeepSeekChatRequest>(req);
                const payload = validateChatRequest(body);

                if (!payload.stream) {
                    let content = '';
                    await deepSeekClient.completeChatFlow(
                        payload.prompt,
                        payload.role,
                        {
                            onData: (chunk) => {
                                content += chunk;
                            }
                        },
                        payload.systemPrompt
                    );

                    writeJson(res, 200, {
                        ok: true,
                        role: payload.role,
                        content
                    });
                    return;
                }

                res.writeHead(200, withCorsHeaders({
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    Connection: 'keep-alive'
                }));

                let responseClosed = false;
                req.on('close', () => {
                    responseClosed = true;
                });

                const writeEvent = (eventName: string, eventPayload: unknown): void => {
                    if (responseClosed || res.writableEnded) {
                        return;
                    }
                    res.write(`event: ${eventName}\n`);
                    res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
                };

                let completed = false;
                try {
                    await deepSeekClient.completeChatFlow(
                        payload.prompt,
                        payload.role,
                        {
                            onData: (chunk) => {
                                writeEvent('data', { content: chunk });
                            },
                            onComplete: () => {
                                completed = true;
                                writeEvent('complete', { ok: true, role: payload.role });
                                if (!res.writableEnded) {
                                    res.end();
                                }
                            }
                        },
                        payload.systemPrompt
                    );

                    if (!completed && !res.writableEnded) {
                        writeEvent('complete', { ok: true, role: payload.role });
                        res.end();
                    }
                } catch (error) {
                    writeEvent('error', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    if (!res.writableEnded) {
                        res.end();
                    }
                }
                return;
            }

            if (req.method === 'POST' && requestUrl.pathname === '/api/deepseek/session/clear') {
                const body = await readJsonBody<{ role?: string }>(req);
                const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'default_ai_assistant';

                await deepSeekClient.clearSessionData(role);
                writeJson(res, 200, { ok: true, role });
                return;
            }

            writeNotFound(res);
        } catch (error) {
            writeJson(res, 500, {
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
        maLogger.log(`DeepSeek API service listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
        maLogger.log(`Session store: ${DEFAULT_SESSION_FILE}`);
    });
}

void main().catch((error) => {
    maLogger.error('Failed to start DeepSeek API service:', error);
    process.exitCode = 1;
});
