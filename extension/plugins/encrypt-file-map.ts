import fs from 'fs';
import path from 'path';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.FILE_MAP_KEY;

function encryptFileMap(data: any, key: string) {
  const iv = CryptoJS.lib.WordArray.random(16);
  const keyWordArray = CryptoJS.enc.Hex.parse(key);

  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    keyWordArray,
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );

  return {
    encrypted: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
    iv: iv.toString(CryptoJS.enc.Hex),
    authTag: ''
  };
}

function encryptFileMapPlugin() {
  return {
    name: 'encrypt-file-map',

    apply: 'build',

    async closeBundle() {
      const outDir = path.resolve(__dirname, '../dist');
      const mapPath = path.join(outDir, 'file-map.json');

      if (!fs.existsSync(mapPath) || !ENCRYPTION_KEY) {
        console.warn('No file-map.json found or encryption key missing');
        return;
      }

      console.log('🔐 Encrypting file-map.json...');
      console.log('Using encryption key (first 16 chars):', ENCRYPTION_KEY.substring(0, 16) + '...');

      const fileMapContent = fs.readFileSync(mapPath, 'utf8');
      const fileMapData = JSON.parse(fileMapContent);
      const encryptedData = encryptFileMap(fileMapData, ENCRYPTION_KEY);

      fs.writeFileSync(mapPath, JSON.stringify(encryptedData, null, 2));

      console.log('✅ Encrypted file-map.json saved');
    }
  };
}

export default encryptFileMapPlugin