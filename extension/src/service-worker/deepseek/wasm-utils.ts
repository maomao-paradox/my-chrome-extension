class PowWasmModule {
  private wasmLoaded = false;
  private wasmInstance: WebAssembly.Instance | null = null;
  private memoryView: DataView | null = null;
  private stackPointer = 0;

  private getMemory(): ArrayBuffer {
    if (!this.wasmInstance) {throw new Error('WASM not initialized');}
    return this.wasmInstance.exports.memory.buffer;
  }

  private getMemoryView(): DataView {
    const mem = this.getMemory();
    if (!this.memoryView || this.memoryView.buffer !== mem) {
      this.memoryView = new DataView(mem);
    }
    return this.memoryView;
  }

  private allocate(len: number, align: number): number {
    if (!this.wasmInstance) {throw new Error('WASM not initialized');}
    return (this.wasmInstance.exports.__wbindgen_export_0 as (len: number, align: number) => number)(len, align) >>> 0;
  }

  private encodeString(str: string): { ptr: number; len: number } {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const ptr = this.allocate(bytes.length, 1);
    new Uint8Array(this.getMemory()).set(bytes, ptr);
    return { ptr, len: bytes.length };
  }

  private addStackPointer(delta: number): number {
    if (!this.wasmInstance) {throw new Error('WASM not initialized');}
    this.stackPointer = (this.wasmInstance.exports.__wbindgen_add_to_stack_pointer as (delta: number) => number)(delta);
    return this.stackPointer;
  }

  async load(): Promise<void> {
    if (this.wasmLoaded) {return;}

    try {
      const wasmUrl = chrome.runtime.getURL('static/wasm/sha3_wasm_bg.7b9ca65ddd.wasm');
      let response: Response;
            
      try {
        response = await fetch(wasmUrl);
      } catch (error) {
        throw new Error('Failed to fetch WASM file: ' + (error as Error).message);
      }

      let result: WebAssembly.InstantiatedSource | undefined;

      if (typeof WebAssembly.instantiateStreaming === 'function') {
        try {
          result = await WebAssembly.instantiateStreaming(response, { wbg: {} });
        } catch (e) {
          if (!(response.headers && response.headers.get('Content-Type') !== 'application/wasm')) {
            throw e;
          }
        }
      }

      if (!result) {
        const bytes = await response.arrayBuffer();
        result = await WebAssembly.instantiate(bytes, { wbg: {} });
      }

      this.wasmInstance = result.instance;
      this.wasmLoaded = true;
    } catch (error) {
      console.error('Failed to load PoW WASM module:', error);
      throw new Error('PoW WASM initialization failed: ' + (error as Error).message);
    }
  }

  solve(algorithm: string, challenge: string, salt: string, difficulty: number, expireAt: number): number | undefined {
    if (!this.wasmLoaded || !this.wasmInstance) {
      throw new Error('WASM module not loaded');
    }

    if (algorithm !== 'DeepSeekHashV1') {
      throw new Error('Unsupported algorithm: ' + algorithm);
    }

    const prefix = salt + '_' + expireAt + '_';

    try {
      this.addStackPointer(-16);

      const challengeEncoded = this.encodeString(challenge);
      const prefixEncoded = this.encodeString(prefix);

      this.wasmInstance.exports.wasm_solve(
        this.stackPointer,
        challengeEncoded.ptr,
        challengeEncoded.len,
        prefixEncoded.ptr,
        prefixEncoded.len,
        difficulty
      );

      const view = this.getMemoryView();
      const code = view.getInt32(this.stackPointer + 0, true);
      const value = view.getFloat64(this.stackPointer + 8, true);

      return code === 0 ? undefined : value;
    } finally {
      this.addStackPointer(16);
    }
  }
}

export const powWasmModule = new PowWasmModule();
