import storage from "@/stores/chromestorge";
import type { FavoriteSite } from "@/types";
import { generateId } from "@/utils";

export const FAVORITE_SITES_STORAGE_KEY = "favoriteSites";

function normalizeUrl(url: string): string {
  try {
    const normalized = new URL(url);
    normalized.hash = "";
    return normalized.toString();
  } catch {
    return url.trim();
  }
}

export class SiteFavoriteStorage {
  static async getSites(): Promise<FavoriteSite[]> {
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) return [];
      const sites = await storage.ext.local.get(FAVORITE_SITES_STORAGE_KEY, []);
      return Array.isArray(sites) ? sites : [];
    } catch (error) {
      maLogger.error("读取收藏站点失败:", error);
      return [];
    }
  }

  static async saveSite(site: Omit<FavoriteSite, "id" | "timestamp">): Promise<FavoriteSite> {
    const normalizedUrl = normalizeUrl(site.url);
    const sites = await this.getSites();
    const existingIndex = sites.findIndex((item) => normalizeUrl(item.url) === normalizedUrl);
    const saved: FavoriteSite = {
      ...(existingIndex >= 0 ? sites[existingIndex] : { id: generateId(), timestamp: Date.now() }),
      ...site,
      url: normalizedUrl,
      title: site.title.trim() || normalizedUrl,
    };

    if (existingIndex >= 0) sites[existingIndex] = saved;
    else sites.unshift(saved);
    await storage.ext.local.set(FAVORITE_SITES_STORAGE_KEY, sites);
    return saved;
  }
}
