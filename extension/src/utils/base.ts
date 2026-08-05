/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/base.ts
 * @date 2026-02-05T02:38:01.698Z
 */

// !function (n, i) {
// 	"object" == typeof exports && "undefined" != typeof module ? i(exports) : "function" == typeof define && define.amd ? define(["exports"], i) : i((n = "undefined" != typeof globalThis ? globalThis : n || self).US = {})
// }(this, (function (n) {

/**
 * 快速检测一段字符串是否是「语法正确」的 JS 代码
 * 返回 true/false
 */
import { parse } from "@babel/parser";

export function generateId(): string {
  // 生成一个随机的 16 位字符串（base36）,时间戳-随机数
  // 使用时间戳的最后几位和随机数组合，确保唯一性
  const timestamp = Date.now().toString(36).slice(-8);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return (timestamp + "-" + randomPart).slice(0, 16);
}

export function getHash(str: any): string {
  //处理json对象
  if (typeof str === "object") {
    str = JSON.stringify(str);
  }
  return str
    .split("")
    .reduce((hash: number, char: string) => {
      hash = (hash << 5) - hash + char.charCodeAt(0);
      return hash & hash;
    }, 0)
    .toString(36);
}

export function isValidJS(codeString: string): boolean {
  try {
    parse(codeString, {
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      sourceType: "module",
    });
    return true;
  } catch {
    return false;
  }
}
export function randomSelect(
  a: Array<string | number>,
  n = 1,
): string | number | Array<string | number> {
  if (n === 1) {
    return a[Math.floor(Math.random() * a.length)];
  }
  if (n === -1) {
    n = Math.round(Math.random() * a.length);
  }
  function shuffle(array: Array<string | number>) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  const shuffledArray = shuffle(a.slice());
  return shuffledArray.slice(0, n);
}
export function blobToBase64(blob: Blob, mimeType: string): Promise<string> {
  if (!blob || !mimeType) {
    throw new Error("Blob data or MIME type is missing.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      if (base64String && typeof base64String === "string") {
        resolve(`data:${mimeType};base64,${base64String.split(",")[1]}`);
      } else {
        reject(new Error("Failed to convert Blob to Base64."));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error occurred."));
    reader.readAsDataURL(blob);
  });
}
export function base64ToBlob(base64: string, mimeType: string): Blob {
  if (!base64 || !mimeType) {
    throw new Error("Base64 data or MIME type is missing.");
  }
  // 提取Base64数据部分
  const byteString = atob(base64.split(",")[1]);

  // 创建字节数组
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mimeType });
}

export function randomString(e: number, m = "mixed") {
  e = e || 32;
  let a = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz",
    n = "0123456789",
    r = "",
    l = 0;
  switch (m) {
    case "mixed":
      const t = a + n;
      l = t.length;
      for (let i = 0; i < e; i++) {
        r += t.charAt(Math.floor(Math.random() * l));
      }
      break;
    case "number":
      l = n.length;
      for (let i = 0; i < e; i++) {
        r += n.charAt(Math.floor(Math.random() * l));
      }
      break;
    case "alphabet":
      l = a.length;
      for (let i = 0; i < e; i++) {
        r += a.charAt(Math.floor(Math.random() * l));
      }
      break;
  }
  return r;
}
export function randomNum(
  Min: number,
  Max: number,
  format = false,
): number | string {
  const res = Min + Math.round(Math.random() * (Max - Min));
  if (format) {
    const tl = String(Max).length;
    const rl = String(res).length;
    return rl < tl ? String(res).padStart(tl, "0") : res;
  }
  return res;
}
export function generateRandomIDCard(): string {
  const provinces = [
    "11",
    "12",
    "13",
    "14",
    "15",
    "21",
    "22",
    "23",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "50",
    "51",
    "52",
    "53",
    "54",
    "61",
    "62",
    "63",
    "64",
    "65",
  ];
  const provinceCode = randomSelect(provinces);
  const cityCode = randomString(2, "number");
  const countyCode = randomString(2, "number");
  const birthYear = String(randomNum(1970, 1999));
  const birthMonth = String(randomNum(1, 12, true));
  const birthDay = String(randomNum(1, 28, true));
  const sequenceCode = randomString(3, "number");
  const base =
    provinceCode +
    cityCode +
    countyCode +
    birthYear +
    birthMonth +
    birthDay +
    sequenceCode;

  // 计算校验码
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  const sum = base
    .split("")
    .reduce((acc, cur, idx) => acc + parseInt(cur) * weights[idx], 0);
  const checkCode = checkCodes[sum % 11];

  return base + checkCode;
}
export function generateRandomPhoneNumber(): string {
  const prefixes = [
    "130",
    "131",
    "132",
    "133",
    "134",
    "135",
    "136",
    "137",
    "138",
    "139",
    "150",
    "151",
    "152",
    "153",
    "155",
    "156",
    "157",
    "158",
    "159",
    "170",
    "171",
    "172",
    "173",
    "175",
    "176",
    "177",
    "178",
    "180",
    "181",
    "182",
    "183",
    "184",
    "185",
    "186",
    "187",
    "188",
    "189",
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = randomString(8, "number");
  return prefix + suffix;
}
export async function getFirstClipboard(): Promise<string> {
  try {
    const navigator = (window as any).__POWERED_BY_WUJIE__
        ? window.parent.navigator
        : window.navigator,
      text = await navigator.clipboard.readText();
    maLogger.log("FirstClipboard: ", text);
    return text;
  } catch (error: any) {
    maLogger.error("Failed to read clipboard contents: ", error);
    return error.message;
  }
}
export function getQueryParams(url?: string): Record<string, string> {
  url = url || window.location.href;
  const urlObj = new URL(url);
  const queryString = urlObj.hash.split("?")[1];
  const searchParams = new URLSearchParams(queryString);
  return Object.fromEntries(searchParams);
}
export function parseCSV(
  csvContent: string,
): Array<Record<string, string | null>> {
  try {
    // 使用 CSV 解析库（如 PapaParse）或自定义解析逻辑
    maLogger.log("CSV 内容：", csvContent);

    // 简单解析示例
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");
    const data: Array<Record<string, string | null>> = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() !== "") {
        const values = lines[i].split(",");
        const obj: Record<string, string | null> = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j].trim()] = values[j]
            ? values[j].trim()
            : data[i - 2][headers[j].trim()]
              ? data[i - 2][headers[j].trim()]!.trim()
              : null;
        }
        data.push(obj);
      }
    }
    maLogger.log("解析后的数据：", data);
    return data;
  } catch (error) {
    maLogger.error("解析 CSV 文件时出错：", error);
    return [];
  }
}
