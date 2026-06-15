/**
 * 精简版 WASM Worker - PoW 计算专用
 * 提取自原始文件的核心绑定代码
 */

let wasmInstance = null;
let memoryView = null;
let stackPointer = 0;

function getMemory() {
    if (!wasmInstance) throw new Error('WASM not initialized');
    return wasmInstance.exports.memory.buffer;
}

function getMemoryView() {
    const mem = getMemory();
    if (!memoryView || memoryView.buffer !== mem) {
        memoryView = new DataView(mem);
    }
    return memoryView;
}

/**
 * 内存分配函数（wasm-bindgen 风格）
 * @param len 长度
 * @param align 对齐方式（通常为 1）
 */
function allocate(len, align) {
    if (!wasmInstance) throw new Error('WASM not initialized');
    return wasmInstance.exports.__wbindgen_export_0(len, align) >>> 0;
}

/**
 * 字符串编码函数（wasm-bindgen 风格）
 * 将 JavaScript 字符串编码为 WASM 内存中的 UTF-8
 */
function encodeString(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const ptr = allocate(bytes.length, 1);
    new Uint8Array(getMemory()).set(bytes, ptr);
    return { ptr, len: bytes.length };
}

/**
 * 栈指针操作
 */
function addStackPointer(delta) {
    if (!wasmInstance) throw new Error('WASM not initialized');
    stackPointer = wasmInstance.exports.__wbindgen_add_to_stack_pointer(delta);
    return stackPointer;
}

/**
 * WASM 初始化
 */
async function initWasm(wasmUrl) {
    if (wasmInstance) return wasmInstance.exports;
    
    let response;
    
    try {
        response = await fetch(wasmUrl);
    } catch (error) {
        throw new Error('Failed to fetch WASM file: ' + error.message);
    }
    
    let bytes;
    let result;
    
    if (typeof WebAssembly.instantiateStreaming === 'function') {
        try {
            result = await WebAssembly.instantiateStreaming(response, { wbg: {} });
        } catch (e) {
            if (response.headers && response.headers.get('Content-Type') !== 'application/wasm') {
                console.warn('Falling back to instantiate due to incorrect MIME type');
            } else {
                throw e;
            }
        }
    }
    
    if (!result) {
        bytes = await response.arrayBuffer();
        result = await WebAssembly.instantiate(bytes, { wbg: {} });
    }
    
    wasmInstance = result.instance;
    return wasmInstance.exports;
}

/**
 * PoW 计算核心函数
 */
function solvePow(algorithm, challenge, salt, difficulty, expireAt) {
    if (algorithm !== 'DeepSeekHashV1') {
        throw new Error('Unsupported algorithm: ' + algorithm);
    }
    
    const prefix = salt + '_' + expireAt + '_';
    
    try {
        // 在栈上分配 16 字节空间用于返回值
        addStackPointer(-16);
        
        // 编码字符串
        const challengeEncoded = encodeString(challenge);
        const prefixEncoded = encodeString(prefix);
        
        // 调用 WASM 函数
        wasmInstance.exports.wasm_solve(
            stackPointer,
            challengeEncoded.ptr,
            challengeEncoded.len,
            prefixEncoded.ptr,
            prefixEncoded.len,
            difficulty
        );
        
        // 读取返回值
        const view = getMemoryView();
        const code = view.getInt32(stackPointer + 0, true);
        const value = view.getFloat64(stackPointer + 8, true);
        
        return code === 0 ? undefined : value;
    } finally {
        // 恢复栈指针
        addStackPointer(16);
    }
}

/**
 * Worker 消息处理
 */
onmessage = async function(e) {
    if (e.data.type !== 'pow-challenge') return;
    
    try {
        await initWasm(e.data.wasmUrl);
        
        const { algorithm, challenge, salt, difficulty, signature, expireAt } = e.data.challenge;
        const answer = solvePow(algorithm, challenge, salt, difficulty, expireAt);
        
        if (typeof answer !== 'number') {
            throw new Error('No solution found');
        }
        
        postMessage({
            type: 'pow-answer',
            answer: { algorithm, challenge, salt, answer, signature }
        });
    } catch (error) {
        postMessage({ type: 'pow-error', error: error.message || error });
    }
};