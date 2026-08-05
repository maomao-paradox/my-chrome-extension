import CryptoJS from 'crypto-js';

interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
}

interface FileMap {
    [key: string]: string;
}

class FileMapDecryptor {
  private key: string;
  private cache: FileMap | null;

  constructor(key: string = 'mria_extension_default_key_32bytes_1234567890abcdef') {
    this.key = key;
    this.cache = null;
  }

  async decryptAndLoad(encryptedFilePath: string): Promise<FileMap> {
    if (this.cache) {return this.cache;}

    try {
      const response = await fetch(encryptedFilePath);
      const rawData = await response.json();

      let decrypted: FileMap;
            
      if (this.isEncrypted(rawData)) {
        decrypted = this.decrypt(rawData);
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

  private isEncrypted(data: any): data is EncryptedData {
    return data && typeof data === 'object' && 
               'encrypted' in data && 
               'iv' in data;
  }

  private decrypt(encryptedData: EncryptedData): FileMap {
    const { encrypted, iv } = encryptedData;

    const keyWordArray = CryptoJS.enc.Hex.parse(this.key);
    const ivWordArray = CryptoJS.enc.Hex.parse(iv);
    const ciphertextWordArray = CryptoJS.enc.Hex.parse(encrypted);

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertextWordArray
    });
        
    const decryptedWordArray = CryptoJS.AES.decrypt(
      cipherParams,
      keyWordArray,
      {
        iv: ivWordArray,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    const decryptedString = decryptedWordArray.toString(CryptoJS.enc.Utf8);
        
    if (!decryptedString) {
      throw new Error('Failed to decrypt: Invalid key or corrupted data');
    }
        
    return JSON.parse(decryptedString);
  }

  clearCache(): void {
    this.cache = null;
  }
}

export default FileMapDecryptor;