import storage from '@/stores/chromestorge';
import { Bookmark, BookmarkComment } from '@/types/components';
import { generateId } from '@/utils/base';

const BOOKMARKS_STORAGE_KEY = 'textSelectionToolbookmarks';

export class BookmarkStorage {
  /**
   * 保存书签
   * @param bookmark 书签对象
   */
  static async saveBookmark(bookmark: Omit<Bookmark, 'id' | 'timestamp'>): Promise<Bookmark> {
    try {
      const bookmarks = await this.getBookmarks();
      
      const newBookmark: Bookmark = {
        ...bookmark,
        id: generateId(),
        timestamp: Date.now(),
        comments: [],
      };
      
      bookmarks.push(newBookmark);
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
      return Array.isArray(bookmarks) ? bookmarks.map(bookmark => ({
        ...bookmark,
        comments: bookmark.comments || [],
      })) : [];
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
  
  /**
   * 为书签添加留言
   * @param bookmarkId 书签ID
   * @param commentText 留言内容
   */
  static async addComment(bookmarkId: string, commentText: string): Promise<Bookmark | null> {
    try {
      const bookmarks = await this.getBookmarks();
      const index = bookmarks.findIndex(bookmark => bookmark.id === bookmarkId);
      
      if (index === -1) {
        return null;
      }
      
      const newComment: BookmarkComment = {
        id: generateId(),
        comment: commentText,
        timestamp: Date.now(),
      };
      
      if (!bookmarks[index].comments) {
        bookmarks[index].comments = [];
      }
      bookmarks[index].comments.push(newComment);
      
      await storage.ext.local.set(BOOKMARKS_STORAGE_KEY, bookmarks);
      return bookmarks[index];
    } catch (error) {
      maLogger.error('添加留言失败:', error);
      return null;
    }
  }
  
  /**
   * 删除书签的留言
   * @param bookmarkId 书签ID
   * @param commentId 留言ID
   */
  static async deleteComment(bookmarkId: string, commentId: string): Promise<Bookmark | null> {
    try {
      const bookmarks = await this.getBookmarks();
      const index = bookmarks.findIndex(bookmark => bookmark.id === bookmarkId);
      
      if (index === -1) {
        return null;
      }
      
      bookmarks[index].comments = bookmarks[index].comments?.filter(comment => comment.id !== commentId) || [];
      
      await storage.ext.local.set(BOOKMARKS_STORAGE_KEY, bookmarks);
      return bookmarks[index];
    } catch (error) {
      maLogger.error('删除留言失败:', error);
      return null;
    }
  }
}