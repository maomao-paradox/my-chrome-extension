/**
 * WASM 版本的 FileMap 解密器
 * 使用 Rust WASM 进行 AES-CBC 解密
 */

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

interface FileMap {
  [key: string]: string;
}

class WasmFileMapDecryptor {
  private key: string;
  private cache: FileMap | null;
  private wasmLoaded: boolean;
  private wasmModule: Record<
    'decrypt_file_map',
    (encrypted: string, iv: string, key: string) => string
  > | null;

  constructor(
    key: string = 'mria_extension_default_key_32bytes_1234567890abcdef'
  ) {
    this.key = key;
    this.cache = null;
    this.wasmLoaded = false;
    this.wasmModule = null;
  }

  private async loadWasm(): Promise<void> {
    if (this.wasmLoaded) {
      return;
    }

    try {
      const wasmUrl = chrome.runtime.getURL('static/wasm/aes_wasm_bg.js');
      const { default: initWasm, decrypt_file_map } = await import(
        /* @vite-ignore */ wasmUrl
      );

      await initWasm();
      this.wasmModule = { decrypt_file_map };
      this.wasmLoaded = true;
    } catch (error) {
      maLogger.error('Failed to load WASM module:', error);
      throw new Error('WASM initialization failed');
    }
  }

  async decryptAndLoad(encryptedFilePath: string): Promise<FileMap> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const response = await fetch(encryptedFilePath);
      const rawData = await response.json();

      let decrypted: FileMap;

      if (this.isEncrypted(rawData)) {
        decrypted = await this.decrypt(rawData);
      } else {
        decrypted = rawData as FileMap;
      }

      this.cache = decrypted;
      return decrypted;
    } catch (error) {
      maLogger.error('Failed to decrypt file map:', error);
      throw error;
    }
  }

  private isEncrypted(data: EncryptedData): boolean {
    return (
      data && typeof data === 'object' && 'encrypted' in data && 'iv' in data
    );
  }

  private async decrypt(encryptedData: EncryptedData): Promise<FileMap> {
    const { encrypted, iv } = encryptedData;

    await this.loadWasm();

    const decryptedString = this.wasmModule?.decrypt_file_map(
      encrypted,
      iv,
      this.key
    );

    if (!decryptedString) {
      throw new Error('Failed to decrypt: Invalid key or corrupted data');
    }

    return JSON.parse(decryptedString);
  }

  clearCache(): void {
    this.cache = null;
  }
}

export default WasmFileMapDecryptor;
