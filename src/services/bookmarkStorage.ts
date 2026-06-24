import storage from '@/stores/chromestorge';
import { Bookmark } from '@/types/components';
import { generateId } from '@/utils/base';

const BOOKMARKS_STORAGE_KEY = 'textSelectionToolbookmarks';

export class BookmarkStorage {
  /**
   * 保存书签
   * @param bookmark 书签对象
   */
  static async saveBookmark(bookmark: Omit<Bookmark, 'id' | 'timestamp'>): Promise<Bookmark> {
    try {
      // 获取现有的书签列表
      const bookmarks = await this.getBookmarks();
      
      // 创建新书签
      const newBookmark: Bookmark = {
        ...bookmark,
        id: generateId(),
        timestamp: Date.now(),
      };
      
      // 添加到书签列表
      bookmarks.push(newBookmark);
      
      // 保存到存储
      await storage.ext.local.set(BOOKMARKS_STORAGE_KEY, bookmarks);
      
      return newBookmark;
    } catch (error) {
      maLogger.error('保存书签失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取所有书签
   */
  static async getBookmarks(): Promise<Bookmark[]> {
    try {
      const bookmarks = await storage.ext.local.get(BOOKMARKS_STORAGE_KEY, []);
      return Array.isArray(bookmarks) ? bookmarks : [];
    } catch (error) {
      maLogger.error('获取书签失败:', error);
      return [];
    }
  }
  
  /**
   * 根据ID获取书签
   * @param id 书签ID
   */
  static async getBookmarkById(id: string): Promise<Bookmark | null> {
    try {
      const bookmarks = await this.getBookmarks();
      return bookmarks.find(bookmark => bookmark.id === id) || null;
    } catch (error) {
      maLogger.error('获取书签失败:', error);
      return null;
    }
  }
  
  /**
   * 删除书签
   * @param id 书签ID
   */
  static async deleteBookmark(id: string): Promise<boolean> {
    try {
      const bookmarks = await this.getBookmarks();
      const updatedBookmarks = bookmarks.filter(bookmark => bookmark.id !== id);
      
      await storage.ext.local.set(BOOKMARKS_STORAGE_KEY, updatedBookmarks);
      return true;
    } catch (error) {
      maLogger.error('删除书签失败:', error);
      return false;
    }
  }
  
  /**
   * 清空所有书签
   */
  static async clearBookmarks(): Promise<boolean> {
    try {
      await storage.ext.local.remove(BOOKMARKS_STORAGE_KEY);
      return true;
    } catch (error) {
      maLogger.error('清空书签失败:', error);
      return false;
    }
  }
}