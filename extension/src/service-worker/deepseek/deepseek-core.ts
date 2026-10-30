export const DEFAULT_DEEPSEEK_API_BASE_URL = 'https://chat.deepseek.com';
export const DEFAULT_DEEPSEEK_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

export interface SessionData {
    sessionId: string | null;
    parentMessageId: number | null;
}

export interface DeepSeekPowChallenge {
    algorithm: string;
    challenge: string;
    salt: string;
    difficulty: number;
    signature: string;
    expire_at?: number;
    expireAt?: number;
    [key: string]: unknown;
}

export interface ChatFlowResult {
  text: string;
  functionCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
}

export interface DeepSeekStreamCallbacks {
    onData?: (data: string) => void;
    onError?: (error: unknown) => void;
    onComplete?: (result?: ChatFlowResult) => void;
}

export interface DeepSeekSessionStore {
    get(role: string): Promise<SessionData | null>;
    set(role: string, sessionData: SessionData): Promise<void>;
    clear(role: string): Promise<void>;
}

export interface DeepSeekPowSolver {
    /**
     * 解决 PoW 挑战
     * @param challenge 服务器返回的 PoW 挑战数据
     * @param targetPath 可选的目标接口路径，用于覆盖 challenge 中的 target_path
     */
    solve(challenge: DeepSeekPowChallenge, targetPath?: string): Promise<string>;
}

export interface DeepSeekClientOptions {
    sessionStore: DeepSeekSessionStore;
    powSolver: DeepSeekPowSolver;
    apiBaseUrl?: string;
    authToken: string;
    cookies: string;
    userAgent?: string;
    fetchImpl?: typeof fetch;
}

export interface DeepSeekCompletionOptions {
    prompt: string;
    chat_session_id: string;
    parent_message_id?: number | null;
    /** 已上传文件的 file_id 列表，用于在对话中引用图片 */
    ref_file_ids?: string[];
}

export interface DeepSeekWebTool {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters: unknown;
    };
}

interface DeepSeekRequestOptions {
    headers?: Record<string, string>;
    body?: string;
}

function createEmptyStreamError(source: string, rawSample: string): Error {
    const normalizedSample = rawSample.trim().replace(/\s+/g, ' ').slice(0, 800);
    let detail = normalizedSample || 'empty response body';

    try {
        const parsed = JSON.parse(rawSample) as Record<string, unknown>;
        const message = parsed.message || parsed.msg || parsed.error || parsed.code;
        if (message) {
            detail = String(message);
        }
    } catch {
        // Keep the raw sample when the body is not JSON.
    }

    return new Error(`${source} stream completed without content: ${detail}`);
}

function normalizeRole(role: string): string {
    return role || 'default_ai_assistant';
}

function isInvalidChatSessionError(error: unknown): boolean {
    return error instanceof Error && error.message.toLowerCase().includes('invalid chat session id');
}

function extractActualContent(content: string): string {
    let processedContent = content;

    for (const marker of ['FINISHED']) {
        if (processedContent.endsWith(marker)) {
            processedContent = processedContent.slice(0, -marker.length).trim();
        }
    }

    return processedContent;
}

function extractResponseSnapshotContent(payload: Record<string, unknown>): string {
    const snapshotContainer = payload.v;
    if (!snapshotContainer || typeof snapshotContainer !== 'object') {
        return '';
    }

    const response = (snapshotContainer as Record<string, unknown>).response;
    if (!response || typeof response !== 'object') {
        return '';
    }

    const responseRecord = response as Record<string, unknown>;
    const content = responseRecord.content;
    if (typeof content === 'string' && content.length > 0) {
        return extractActualContent(content);
    }

    // DeepSeek 首个快照使用 fragments 承载已生成内容，例如：
    // { v: { response: { fragments: [{ type: "RESPONSE", content: "[\\n" }] } } }
    // 后续增量包才通过 p=response/fragments/-1/content + APPEND 发送。
    const fragments = responseRecord.fragments;
    if (!Array.isArray(fragments)) {
        return '';
    }

    return fragments
        .map((fragment) => {
            if (!fragment || typeof fragment !== 'object') {
                return '';
            }
            const fragmentRecord = fragment as Record<string, unknown>;
            if (typeof fragmentRecord.type === 'string' && fragmentRecord.type !== 'RESPONSE') {
                return '';
            }
            return typeof fragmentRecord.content === 'string' ? extractActualContent(fragmentRecord.content) : '';
        })
        .join('');
}

function extractDeepSeekTextValue(value: unknown): string {
    if (typeof value === 'string') {
        return extractActualContent(value);
    }

    if (Array.isArray(value)) {
        return value.map(extractDeepSeekTextValue).join('');
    }

    if (!value || typeof value !== 'object') {
        return '';
    }

    const record = value as Record<string, unknown>;
    return (
        extractDeepSeekTextValue(record.content) ||
        extractDeepSeekTextValue(record.text) ||
        extractDeepSeekTextValue(record.answer) ||
        extractDeepSeekTextValue(record.output_text) ||
        extractDeepSeekTextValue(record.delta) ||
        extractDeepSeekTextValue(record.message)
    );
}

function parseDeepSeekDataPayload(payload: unknown): {
    content: string;
    isComplete: boolean;
} {
    let content = '';
    let isComplete = false;

    if (!payload || typeof payload !== 'object') {
        return { content, isComplete };
    }

    const json = payload as Record<string, unknown>;

    if (typeof json.v === 'string') {
        content += extractActualContent(json.v);
        return { content, isComplete };
    }

    if (typeof json.p === 'string' && json.p.includes('content')) {
        content += extractDeepSeekTextValue(json.v);
        return { content, isComplete };
    }

    const snapshotContent = extractResponseSnapshotContent(json);
    if (snapshotContent) {
        content += snapshotContent;
        return { content, isComplete };
    }

    if (json.p === 'response' && json.o === 'BATCH' && Array.isArray(json.v)) {
        for (const batchItem of json.v) {
            const parsedBatchItem = parseDeepSeekDataPayload(batchItem);
            content += parsedBatchItem.content;
            isComplete = isComplete || parsedBatchItem.isComplete;

            if (
                batchItem &&
                typeof batchItem === 'object' &&
                (batchItem as Record<string, unknown>).p === 'status' &&
                (batchItem as Record<string, unknown>).v === 'FINISHED'
            ) {
                isComplete = true;
                break;
            }
        }
    }

    content += extractDeepSeekTextValue(json);

    return { content, isComplete };
}

export function parseDeepSeekStreamLines(lines: string[]): {
    content: string;
    isComplete: boolean;
} {
    let content = '';
    let isComplete = false;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            continue;
        }

        if (trimmedLine.startsWith('event: ')) {
            if (trimmedLine.slice(7) === 'finish') {
                isComplete = true;
            }
            continue;
        }

        if (!trimmedLine.startsWith('data: ')) {
            continue;
        }

        const jsonStr = trimmedLine.slice(6);

        try {
            const parsedPayload = parseDeepSeekDataPayload(JSON.parse(jsonStr));
            content += parsedPayload.content;
            isComplete = isComplete || parsedPayload.isComplete;
        } catch {
            // Ignore incomplete or malformed SSE frames.
        }
    }

    return { content, isComplete };
}

export function normalizeSystemPrompt(systemPrompt?: string): string {
    return typeof systemPrompt === 'string' ? systemPrompt.trim() : '';
}

export function buildPromptWithSystemPrompt(
    prompt: string,
    systemPrompt?: string,
    tools: DeepSeekWebTool[] = [],
): string {
    const normalizedSystemPrompt = normalizeSystemPrompt(systemPrompt);
    if (!normalizedSystemPrompt && tools.length === 0) {
        return prompt;
    }

    const sections = ['[SYSTEM PROTOCOL]'];
    if (normalizedSystemPrompt) {
        sections.push(normalizedSystemPrompt);
    }
    if (tools.length > 0) {
        sections.push(
            '',
            '[AVAILABLE WEBMCP TOOLS]',
            JSON.stringify(tools.map(({ function: tool }) => tool)),
            '',
            '[TOOL CALL PROTOCOL]',
            'If a listed tool is needed, respond with exactly one <webmcp_tool_calls>...</webmcp_tool_calls> block containing JSON shaped as {"tool_calls":[{"name":"tool_name","arguments":{}}]}. Use only listed tool names and provide arguments matching the schema. Do not include markdown or prose in the block. If no tool is needed, answer normally without this block.',
        );
    }
    sections.push('', '[USER REQUEST]', prompt);
    return sections.join('\n');
}

export function parseDeepSeekToolCalls(
    content: string,
    tools: DeepSeekWebTool[],
): Array<{ id: string; name: string; args: Record<string, unknown> }> {
    const availableNames = new Set(tools.map(({ function: tool }) => tool.name));
    const payloads: Array<{ name: string; body: string }> = [];
    const markerMatch = content.match(/<webmcp_tool_calls>\s*([\s\S]*?)\s*<\/webmcp_tool_calls>/i);
    if (markerMatch) {
        payloads.push({ name: 'webmcp_tool_calls', body: markerMatch[1] });
    }

    const dsmlInvokePattern = /<｜｜DSML｜｜\s*invoke\s+name="([^"]+)"\s*>([\s\S]*?)<\/｜｜DSML｜｜\s*parameter\s*>[\s\S]*?<\/｜｜DSML｜｜\s*invoke\s*>/gi;
    for (const match of content.matchAll(dsmlInvokePattern)) {
        payloads.push({ name: match[1], body: match[2] });
    }

    if (payloads.length === 0) {
        return [];
    }

    const calls: Array<{ name: unknown; arguments: unknown }> = [];
    for (const { name: invokedName, body } of payloads) {
        let payload: unknown;
        try {
            payload = JSON.parse(body.trim());
        } catch (error) {
            throw new Error(
                `DeepSeek returned invalid WebMCP tool-call JSON: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        if (invokedName === 'webmcp_tool_calls') {
            if (!payload || typeof payload !== 'object' || !Array.isArray((payload as Record<string, unknown>).tool_calls)) {
                throw new Error('DeepSeek returned an invalid WebMCP tool-call response.');
            }
            calls.push(...(payload as { tool_calls: Array<{ name: unknown; arguments: unknown }> }).tool_calls);
        } else if (availableNames.has(invokedName)) {
            calls.push({ name: invokedName, arguments: payload });
        } else {
            throw new Error(`DeepSeek requested an unavailable WebMCP tool: ${invokedName}.`);
        }
    }

    return calls.map((call, index) => {
        if (!call || typeof call !== 'object') {
            throw new Error(`DeepSeek returned an invalid tool call at index ${index}.`);
        }
        const name = call.name;
        const args = call.arguments;
        if (typeof name !== 'string' || !availableNames.has(name)) {
            throw new Error(`DeepSeek requested an unavailable WebMCP tool: ${String(name)}.`);
        }
        if (!args || typeof args !== 'object' || Array.isArray(args)) {
            throw new Error(`DeepSeek returned invalid arguments for WebMCP tool "${name}".`);
        }
        return {
            id: `deepseek_${index}`,
            name,
            args: args as Record<string, unknown>,
        };
    });
}

function generateStreamId(): string {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const randomValue = (Math.random() * 16) | 0;
        const nextValue = char === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
        return nextValue.toString(16);
    });

    return `${year}${month}${day}-${uuid.replace(/-/g, '').slice(0, 16)}`;
}

function nextParentMessageId(currentParentMessageId: number | null): number {
    return currentParentMessageId === null ? 2 : currentParentMessageId + 2;
}

function getRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

export function extractDeepSeekSessionId(result: unknown): string | null {
    const root = getRecord(result);
    const data = getRecord(root?.data);
    const businessData = getRecord(data?.biz_data);
    const chatSession = getRecord(businessData?.chat_session);
    const session = getRecord(businessData?.session);
    const candidates = [
        businessData?.id,
        businessData?.chat_session_id,
        businessData?.session_id,
        chatSession?.id,
        session?.id,
        data?.chat_session_id,
        data?.session_id,
        data?.id,
        root?.chat_session_id,
        root?.session_id,
        root?.id,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            return String(candidate);
        }
    }

    return null;
}

export function describeDeepSeekResponseError(result: unknown): string {
    const root = getRecord(result);
    const data = getRecord(root?.data);
    const businessData = getRecord(data?.biz_data);
    const messageCandidates = [
        data?.biz_msg,
        businessData?.biz_msg,
        businessData?.msg,
        businessData?.message,
        root?.msg,
        root?.message,
        data?.message,
        getRecord(root?.error)?.message,
        root?.error,
    ];
    const codeCandidates = [
        data?.biz_code,
        businessData?.biz_code,
        businessData?.code,
        root?.code,
        getRecord(root?.error)?.code,
    ];
    const message = messageCandidates.find(
        (candidate): candidate is string =>
            typeof candidate === 'string' && !!candidate.trim(),
    );
    const code = codeCandidates.find(
        (candidate) =>
            typeof candidate === 'string' || typeof candidate === 'number',
    );
    const details = [
        code !== undefined ? `code ${String(code)}` : '',
        message?.trim() ?? '',
    ].filter(Boolean);

    return details.join(': ');
}

export class DeepSeekClient {
    private readonly sessionStore: DeepSeekSessionStore;
    private readonly powSolver: DeepSeekPowSolver;
    private readonly apiBaseUrl: string;
    private readonly authToken: string;
    private readonly cookies: string;
    private readonly userAgent: string;
    private readonly fetchImpl: typeof fetch;

    constructor(options: DeepSeekClientOptions) {
        this.sessionStore = options.sessionStore;
        this.powSolver = options.powSolver;
        this.apiBaseUrl = options.apiBaseUrl || DEFAULT_DEEPSEEK_API_BASE_URL;
        this.authToken = options.authToken;
        this.cookies = options.cookies;
        this.userAgent = options.userAgent || DEFAULT_DEEPSEEK_USER_AGENT;
        const resolvedFetch = options.fetchImpl || globalThis.fetch;
        this.fetchImpl = resolvedFetch.bind(globalThis) as typeof fetch;
    }

    async clearSessionData(role: string): Promise<void> {
        await this.sessionStore.clear(normalizeRole(role));
    }

    async createSession(): Promise<unknown> {
        return this.sendRequest('/api/v0/chat_session/create', {
            headers: {
                Cookie: this.cookies,
            },
        });
    }

    /**
     * 创建 PoW 挑战，支持自定义 target_path 以适配不同的受保护接口
     * @param targetPath 需要 PoW 保护的目标接口路径，默认 `/api/v0/chat/completion`
     */
    async createPowChallenge(targetPath = '/api/v0/chat/completion'): Promise<unknown> {
        return this.sendRequest('/api/v0/chat/create_pow_challenge', {
            body: JSON.stringify({ target_path: targetPath }),
        });
    }

    async completion(
        options: DeepSeekCompletionOptions,
        powResponse: string,
        callbacks?: DeepSeekStreamCallbacks,
    ): Promise<unknown> {
        const body = JSON.stringify({
            ...options,
            ref_file_ids: options.ref_file_ids ?? [],
            thinking_enabled: false,
            search_enabled: false,
            client_stream_id: generateStreamId(),
        });

        if (callbacks?.onData) {
            await this.sendStreamingRequest(
                '/api/v0/chat/completion',
                {
                    headers: { 'x-ds-pow-response': powResponse },
                    body,
                },
                callbacks,
            );
            return null;
        }

        return this.sendRequest('/api/v0/chat/completion', {
            headers: { 'x-ds-pow-response': powResponse },
            body,
        });
    }

    /**
     * 上传文件到 DeepSeek，完整走 PoW 保护流程
     *
     * 注意：服务端只接受 multipart/form-data，字段名为 `file`，
     * 且**靠文件名后缀识别类型**（png/jpg/jpeg/webp/gif），裸二进制会返回 400。
     *
     * @param fileData 文件二进制数据
     * @param contentType 文件 MIME 类型，默认 image/png
     * @param fileName 上传文件名，必须带支持的图片后缀，默认 image.png
     * @returns 上传成功后的文件 ID（如 "file-xxx-xxx"）
     */
    async uploadFile(
        fileData: ArrayBuffer | Uint8Array | Blob,
        contentType = 'image/png',
        fileName = 'image.png',
    ): Promise<string> {
        const targetPath = '/api/v0/file/upload_file';

        // 阶段1: 为文件上传接口创建 PoW 挑战
        const challengeResponse = (await this.createPowChallenge(targetPath)) as {
            data?: { biz_data?: { challenge?: DeepSeekPowChallenge } };
        };
        const challenge = challengeResponse?.data?.biz_data?.challenge;
        if (!challenge) {
            throw new Error('Failed to create POW challenge for file upload');
        }

        // 阶段2: 解决 PoW 挑战（传入对应 target_path）
        const powResponse = await this.powSolver.solve(challenge, targetPath);
        if (!powResponse) {
            throw new Error('Failed to generate POW response for file upload');
        }

        // 阶段3: 携带 PoW 响应上传文件（multipart/form-data）
        const url = `${this.apiBaseUrl}${targetPath}`;
        const headers = this.createRequestHeaders({
            'x-ds-pow-response': powResponse,
        });
        // FormData 会自动生成 multipart boundary，手动设置的 Content-Type 反而会让
        // 服务端解析失败（Invalid `boundary` for `multipart/form-data` request）
        headers.delete('Content-Type');

        const blob =
            fileData instanceof Blob
                ? fileData
                : new Blob([fileData as BlobPart], { type: contentType });
        const form = new FormData();
        // 字段名必须是 file；文件名后缀决定服务端识别的文件类型
        form.append('file', blob, fileName);

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers,
            body: form,
            redirect: 'follow',
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`DeepSeek file upload failed with status ${response.status}: ${responseText}`);
        }

        const parsed = responseText ? JSON.parse(responseText) : null;
        if (!parsed) {
            throw new Error('DeepSeek file upload returned empty response');
        }

        // 从响应中提取 file id: data.biz_data.id
        const fileId = (parsed as Record<string, unknown>)
            ?.data && typeof (parsed as Record<string, unknown>).data === 'object'
            ? ((parsed as { data: { biz_data?: { id?: string } } }).data.biz_data?.id)
            : undefined;

        if (!fileId) {
            const details = describeDeepSeekResponseError(parsed);
            throw new Error(
                details
                    ? `DeepSeek file upload failed (${details})`
                    : 'DeepSeek file upload response did not contain a file ID',
            );
        }

        // 上传返回的 file_id 初始状态是 PENDING，必须等到 SUCCESS 才能被
        // ref_file_ids 引用，否则对话接口会返回 biz_code 9「invalid ref file id」
        await this.waitForFileReady(fileId);

        return fileId;
    }

    /**
     * 轮询文件处理状态，直到 SUCCESS 或超时
     * @param fileId 上传返回的文件 ID
     * @param timeoutMs 最长等待时间（默认 30s）
     * @param intervalMs 轮询间隔（默认 1s）
     */
    private async waitForFileReady(
        fileId: string,
        timeoutMs = 30_000,
        intervalMs = 1_000,
    ): Promise<void> {
        const terminalFailures = new Set([
            'FAILED',
            'CONTENT_EMPTY',
            'CONTENT_FILTER',
            'CONTENT_TOO_LONG',
            'CANCELLED',
        ]);
        const deadline = Date.now() + timeoutMs;
        let lastStatus = 'PENDING';

        while (Date.now() < deadline) {
            const headers = this.createRequestHeaders({ Accept: 'application/json' });
            headers.delete('Content-Type'); // GET 无请求体
            const url = `${this.apiBaseUrl}/api/v0/file/fetch_files?file_ids=${encodeURIComponent(fileId)}`;
            const response = await this.fetchImpl(url, {
                method: 'GET',
                headers,
                redirect: 'follow',
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(
                    `DeepSeek file status query failed with status ${response.status}${body ? `: ${body}` : ''}`,
                );
            }

            const parsed = (await response.json().catch(() => null)) as {
                data?: { biz_data?: { files?: Array<{ status?: string }> } };
            } | null;
            const fileStatus = parsed?.data?.biz_data?.files?.[0]?.status;
            lastStatus = fileStatus ? String(fileStatus).toUpperCase() : 'PENDING';

            if (lastStatus === 'SUCCESS') {
                return;
            }
            if (terminalFailures.has(lastStatus)) {
                throw new Error(`DeepSeek file processing failed: status=${lastStatus}`);
            }

            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                break;
            }
            await new Promise((resolve) =>
                setTimeout(resolve, Math.min(intervalMs, remaining)),
            );
        }

        throw new Error(`DeepSeek file processing timed out (last status: ${lastStatus})`);
    }

    async completeChatFlow(
        prompt: string,
        role: string,
        callbacks?: DeepSeekStreamCallbacks,
        systemPrompt?: string,
        tools: DeepSeekWebTool[] = [],
        /** 可选：已上传文件的 file_id 列表，用于在对话中引用图片 */
        fileIds?: string[],
    ): Promise<unknown> {
        const flowStart = performance.now();
        const normalizedRole = normalizeRole(role);
        const preparedPrompt = buildPromptWithSystemPrompt(prompt, systemPrompt, tools);
        let stageTimings: Record<string, number> = {};

        for (let attempt = 0; attempt < 2; attempt += 1) {
            const attemptStart = performance.now();
            try {
                // 阶段1: 获取会话数据
                const sessionStart = performance.now();
                let sessionData = await this.getSessionData(normalizedRole);
                stageTimings['getSession'] = Math.round(performance.now() - sessionStart);

                // 阶段2: 创建会话（如果需要）
                if (!sessionData.sessionId) {
                    const createSessionStart = performance.now();
                    const createSessionResult = await this.createSession();
                    const newSessionId = extractDeepSeekSessionId(createSessionResult);
                    if (!newSessionId) {
                        const details = describeDeepSeekResponseError(createSessionResult);
                        throw new Error(
                            details
                                ? `Failed to create DeepSeek session (${details})`
                                : 'Failed to create DeepSeek session: the response did not contain a session ID. Check the stored DeepSeek login credentials and retry.',
                        );
                    }
                    stageTimings['createSession'] = Math.round(performance.now() - createSessionStart);

                    sessionData = await this.updateSessionData(normalizedRole, {
                        sessionId: newSessionId,
                    });
                }

                // 阶段3: 创建POW挑战
                const powChallengeStart = performance.now();
                const challengeResponse = (await this.createPowChallenge()) as {
                    data?: { biz_data?: { challenge?: DeepSeekPowChallenge } };
                };
                const challenge = challengeResponse?.data?.biz_data?.challenge;
                if (!challenge) {
                    throw new Error('Failed to create POW challenge');
                }
                stageTimings['createPowChallenge'] = Math.round(performance.now() - powChallengeStart);

                // 阶段4: 解决POW挑战（计算耗时）
                const powSolveStart = performance.now();
                const powResponse = await this.powSolver.solve(challenge);
                if (!powResponse) {
                    throw new Error('Failed to generate POW response');
                }
                stageTimings['powSolve'] = Math.round(performance.now() - powSolveStart);

                const currentParentMessageId = sessionData.parentMessageId;
                const sessionId = sessionData.sessionId;
                if (!sessionId) {
                    throw new Error('DeepSeek session is missing after initialization');
                }

                // 阶段5: 发送完成请求（AI模型调用）
                const completionStart = performance.now();
                let streamedContent = '';
                const completionCallbacks = tools.length > 0
                    ? {
                        onData: (content: string) => {
                            streamedContent += content;
                        },
                        onError: callbacks?.onError,
                    }
                    : callbacks;
                const response = await this.completion(
                    {
                        prompt: preparedPrompt,
                        chat_session_id: sessionId,
                        parent_message_id: currentParentMessageId,
                        ref_file_ids: fileIds,
                    },
                    powResponse,
                    completionCallbacks,
                );
                stageTimings['completion'] = Math.round(performance.now() - completionStart);

                // 阶段6: 更新会话数据
                const updateStart = performance.now();
                await this.updateSessionData(normalizedRole, {
                    parentMessageId: nextParentMessageId(currentParentMessageId),
                });
                stageTimings['updateSession'] = Math.round(performance.now() - updateStart);

                // 打印完整的分阶段耗时分析
                const totalTime = Math.round(performance.now() - flowStart);
                console.log(`[DeepSeek Flow] ${role} 完成 (attempt ${attempt + 1}):`, {
                    totalTime: `${totalTime}ms`,
                    stages: {
                        getSession: `${stageTimings['getSession'] || 0}ms`,
                        createSession: `${stageTimings['createSession'] || 'skipped'}`,
                        createPowChallenge: `${stageTimings['createPowChallenge'] || 0}ms`,
                        powSolve: `${stageTimings['powSolve'] || 0}ms`,
                        completion: `${stageTimings['completion'] || 0}ms`,
                        updateSession: `${stageTimings['updateSession'] || 0}ms`,
                    },
                    // 瓶颈分析
                    bottleneck: this.analyzeBottleneck(stageTimings),
                    timestamp: new Date().toISOString(),
                });

                if (tools.length > 0) {
                    const functionCalls = parseDeepSeekToolCalls(streamedContent, tools);
                    if (functionCalls.length > 0) {
                        const result = { text: '', functionCalls };
                        callbacks?.onComplete?.(result);
                        return result;
                    }
                    callbacks?.onData?.(streamedContent);
                    callbacks?.onComplete?.({ text: streamedContent, functionCalls: [] });
                } else {
                    callbacks?.onComplete?.();
                }
                return response;
            } catch (error) {
                const attemptTime = Math.round(performance.now() - attemptStart);
                console.error(`[DeepSeek Flow] ${role} 失败 (attempt ${attempt + 1}, ${attemptTime}ms):`, error);

                if (attempt === 0 && isInvalidChatSessionError(error)) {
                    console.log(`[DeepSeek Flow] ${role} 会话无效，清除后重试...`);
                    await this.clearSessionData(normalizedRole);
                    continue;
                }

                callbacks?.onError?.(error);
                throw error;
            }
        }

        throw new Error('DeepSeek chat flow failed after retry');
    }

    /**
     * 分析各阶段耗时，找出可能的瓶颈
     */
    private analyzeBottleneck(timings: Record<string, number>): string {
        const entries = Object.entries(timings)
            .filter(([_, v]) => typeof v === 'number')
            .sort((a, b) => b[1] - a[1]);

        if (entries.length === 0) {
            return 'unknown';
        }

        const [slowestStage, slowestTime] = entries[0];
        const totalTime = entries.reduce((sum, [_, v]) => sum + v, 0);
        const percentage = totalTime > 0 ? Math.round((slowestTime / totalTime) * 100) : 0;

        if (percentage > 50) {
            return `bottleneck: ${slowestStage} (${slowestTime}ms, ${percentage}%)`;
        }

        return `slowest: ${slowestStage} (${slowestTime}ms, ${percentage}%)`;
    }

    async sendStreamingRequest(
        endpoint: string,
        options: DeepSeekRequestOptions,
        callbacks: DeepSeekStreamCallbacks,
    ): Promise<void> {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const headers = this.createRequestHeaders(options.headers || {});
        const body = options.body || JSON.stringify({});

        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers,
            body,
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let pendingBuffer = '';
        let isCompleted = false;
        let hasContent = false;
        let rawSample = '';

        while (true) {
            const { value, done } = await reader.read();

            if (value) {
                const decodedChunk = decoder.decode(value, { stream: !done });
                rawSample = (rawSample + decodedChunk).slice(0, 4000);
                pendingBuffer += decodedChunk;
                const segments = pendingBuffer.split('\n');
                pendingBuffer = segments.pop() || '';

                const parsed = parseDeepSeekStreamLines(segments);
                if (parsed.content) {
                    hasContent = true;
                    callbacks.onData?.(parsed.content);
                }
                if (parsed.isComplete) {
                    isCompleted = true;
                }
            }

            if (done) {
                if (pendingBuffer.trim()) {
                    const finalParsed = parseDeepSeekStreamLines([pendingBuffer]);
                    if (finalParsed.content) {
                        hasContent = true;
                        callbacks.onData?.(finalParsed.content);
                    }
                    if (finalParsed.isComplete) {
                        isCompleted = true;
                    }
                }
                break;
            }
        }

        if (!isCompleted) {
            // Some DeepSeek responses end by closing the stream without a finish event.
            isCompleted = true;
        }

        if (!hasContent) {
            throw createEmptyStreamError('DeepSeek', rawSample);
        }
    }

    private async getSessionData(role: string): Promise<SessionData> {
        return (
            (await this.sessionStore.get(role)) || {
                sessionId: '',
                parentMessageId: null,
            }
        );
    }

    private async updateSessionData(role: string, updates: Partial<SessionData>): Promise<SessionData> {
        const currentSessionData = await this.getSessionData(role);
        const nextSessionData: SessionData = {
            ...currentSessionData,
            ...updates,
        };

        await this.sessionStore.set(role, nextSessionData);
        return nextSessionData;
    }

    private createRequestHeaders(customHeaders: Record<string, string> = {}): Headers {
        const headers = new Headers();
        const apiHost = this.resolveApiHost();
        headers.set('Authorization', this.authToken);
        headers.set('User-Agent', this.userAgent);
        headers.set('Accept', '*/*');
        headers.set('Host', apiHost);
        headers.set('Connection', 'keep-alive');
        headers.set('Cookie', this.cookies);
        headers.set('Content-Type', 'application/json');

        for (const [header, value] of Object.entries(customHeaders)) {
            headers.set(header, value);
        }

        return headers;
    }

    private resolveApiHost(): string {
        try {
            return new URL(this.apiBaseUrl).host;
        } catch {
            return 'chat.deepseek.com';
        }
    }

    private async sendRequest(endpoint: string, options: DeepSeekRequestOptions = {}): Promise<unknown> {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: this.createRequestHeaders(options.headers || {}),
            redirect: 'follow',
            body: options.body || JSON.stringify({}),
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`DeepSeek request failed with status ${response.status}: ${responseText}`);
        }

        return responseText ? JSON.parse(responseText) : null;
    }
}
