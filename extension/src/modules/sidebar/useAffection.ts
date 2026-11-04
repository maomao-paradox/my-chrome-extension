/**
 * @file modules/sidebar/useAffection.ts
 * @description 订阅 AI 对主人的好感度数值（content script 侧）
 *
 * 好感度由 AIConversation 从 AI 回复里正则提取（如 "好感度73喵"），
 * 写入 chrome.storage.local；这里只读取 + 监听变化。
 *
 * @author Vivy
 * @date 2026-11-04
 */
import { useEffect, useState } from "react";
import { AFFECTION_STORAGE_KEY } from "@/service-worker/background/mcp-tools";

/** 默认好感度 —— 未读到时显示 50（半满） */
const DEFAULT_AFFECTION = 50;

/** content script 中 chrome.storage 是否可用 */
function hasStorage(): boolean {
    return (
        typeof chrome !== "undefined" &&
        typeof chrome.storage !== "undefined" &&
        typeof chrome.storage.local !== "undefined"
    );
}

/**
 * 订阅好感度数值。
 * - 首次挂载读取一次存储
 * - 监听 storage.onChanged，AIConversation 写入后立即更新
 */
export function useAffection(): number {
    const [value, setValue] = useState<number>(DEFAULT_AFFECTION);

    useEffect(() => {
        if (!hasStorage()) return;

        let alive = true;

        chrome.storage.local.get(AFFECTION_STORAGE_KEY, (result) => {
            const raw = result?.[AFFECTION_STORAGE_KEY];
            if (alive && typeof raw === "number") setValue(raw);
        });

        const onChanged = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string,
        ) => {
            if (areaName !== "local" || !changes[AFFECTION_STORAGE_KEY]) return;
            const newValue = changes[AFFECTION_STORAGE_KEY].newValue;
            if (typeof newValue === "number") setValue(newValue);
        };

        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            alive = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    return value;
}

/**
 * 从 AI 回复文本里提取好感度数字。
 * 匹配格式：好感度 + 数字（如 "好感度73"、"好感度 50"、"好感度：120"）
 * 范围 0~100，超出夹取。
 *
 * @returns 好感度数值，没匹配到返回 null
 */
export function extractAffection(text: string): number | null {
    if (!text) return null;
    const match = text.match(/好感度\s*[:：]?\s*(\d+)/);
    if (!match) return null;
    const num = parseInt(match[1], 10);
    if (isNaN(num)) return null;
    return Math.min(100, Math.max(0, num));
}

/**
 * 把好感度写入 storage —— 供 AIConversation 在收到完整 AI 回复后调用。
 */
export async function saveAffection(value: number): Promise<void> {
    if (!hasStorage()) return;
    try {
        await chrome.storage.local.set({ [AFFECTION_STORAGE_KEY]: value });
    } catch {
        // storage 写入失败不影响主流程
    }
}
