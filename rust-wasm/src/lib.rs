use wasm_bindgen::prelude::*;
use aes::Aes256;
use cbc::Decryptor;
use cbc::cipher::{BlockDecryptMut, KeyIvInit};
use hex::decode;

type Aes256CbcDec = Decryptor<Aes256>;

#[wasm_bindgen]
pub fn decrypt_file_map(encrypted_hex: &str, iv_hex: &str, key_hex: &str) -> Result<String, JsValue> {
    // 解码十六进制字符串
    let key = decode(key_hex).map_err(|e| JsValue::from_str(&format!("Failed to decode key: {}", e)))?;
    let iv = decode(iv_hex).map_err(|e| JsValue::from_str(&format!("Failed to decode IV: {}", e)))?;
    let mut encrypted = decode(encrypted_hex).map_err(|e| JsValue::from_str(&format!("Failed to decode encrypted data: {}", e)))?;

    // 验证密钥长度（AES-256 需要 32 字节）
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes (256 bits)"));
    }

    // 验证 IV 长度（CBC 模式需要 16 字节）
    if iv.len() != 16 {
        return Err(JsValue::from_str("IV must be 16 bytes"));
    }

    // 创建解密器
    let cipher = Aes256CbcDec::new(key.as_slice().into(), iv.as_slice().into());
    
    // 执行解密，使用 PKCS7 填充
    // decrypt_padded_mut 会直接在传入的 buffer 上进行原地解密
    let decrypted = cipher
        .decrypt_padded_mut::<cbc::cipher::block_padding::Pkcs7>(&mut encrypted)
        .map_err(|e| JsValue::from_str(&format!("Decryption failed: {}", e)))?;

    // 将解密后的字节转换为 UTF-8 字符串
    let result = String::from_utf8(decrypted.to_vec()).map_err(|e| JsValue::from_str(&format!("Failed to convert to UTF-8: {}", e)))?;

    Ok(result)
}