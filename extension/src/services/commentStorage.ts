import storage from '@/stores/chromestorge';
import { generateId } from '@/utils/base';

export interface Comment {
  id: string;
  text: string;
  comment: string;
  url: string;
  hash: string;
  timestamp: number;
  rangeInfo?: {
    startContainerXPath?: string;
    startOffset?: number;
    endContainerXPath?: string;
    endOffset?: number;
  };
}

const COMMENT_STORAGE_KEY = 'textSelectionComments';

export class CommentStorage {
  /**
   * 获取当前页面的存储键（基于完整URL，包含hash）
   */
  static getPageKey(): string {
    return window.location.href;
  }

  /**
   * 获取当前页面的hash
   */
  static getCurrentHash(): string {
    return window.location.hash || '#';
  }

  /**
   * 保存留言
   */
  static async saveComment(comment: Omit<Comment, 'id' | 'timestamp'>): Promise<Comment> {
    try {
      const comments = await this.getComments();
      
      const newComment: Comment = {
        ...comment,
        id: generateId(),
        timestamp: Date.now(),
      };
      
      comments.push(newComment);
      
      await storage.ext.local.set(COMMENT_STORAGE_KEY, comments);
      
      return newComment;
    } catch (error) {
      maLogger.error('保存留言失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有留言
   */
  static async getComments(): Promise<Comment[]> {
    try {
      const comments = await storage.ext.local.get(COMMENT_STORAGE_KEY, []);
      return Array.isArray(comments) ? comments : [];
    } catch (error) {
      maLogger.error('获取留言失败:', error);
      return [];
    }
  }

  /**
   * 获取当前页面的留言
   */
  static async getCommentsForCurrentPage(): Promise<Comment[]> {
    try {
      const comments = await this.getComments();
      const currentUrl = window.location.origin + window.location.pathname;
      const currentHash = this.getCurrentHash();
      
      return comments.filter(comment => {
        const commentUrl = comment.url.split('#')[0];
        const commentHash = comment.hash;
        
        return commentUrl === currentUrl && commentHash === currentHash;
      });
    } catch (error) {
      maLogger.error('获取当前页面留言失败:', error);
      return [];
    }
  }

  /**
   * 根据ID获取留言
   */
  static async getCommentById(id: string): Promise<Comment | null> {
    try {
      const comments = await this.getComments();
      return comments.find(comment => comment.id === id) || null;
    } catch (error) {
      maLogger.error('获取留言失败:', error);
      return null;
    }
  }

  /**
   * 删除留言
   */
  static async deleteComment(id: string): Promise<boolean> {
    try {
      const comments = await this.getComments();
      const updatedComments = comments.filter(comment => comment.id !== id);
      
      await storage.ext.local.set(COMMENT_STORAGE_KEY, updatedComments);
      return true;
    } catch (error) {
      maLogger.error('删除留言失败:', error);
      return false;
    }
  }

  /**
   * 更新留言
   */
  static async updateComment(id: string, updates: Partial<Pick<Comment, 'comment'>>): Promise<Comment | null> {
    try {
      const comments = await this.getComments();
      const index = comments.findIndex(comment => comment.id === id);
      
      if (index === -1) {
        return null;
      }
      
      comments[index] = {
        ...comments[index],
        ...updates,
        timestamp: Date.now(),
      };
      
      await storage.ext.local.set(COMMENT_STORAGE_KEY, comments);
      return comments[index];
    } catch (error) {
      maLogger.error('更新留言失败:', error);
      return null;
    }
  }

  /**
   * 清空所有留言
   */
  static async clearComments(): Promise<boolean> {
    try {
      await storage.ext.local.remove(COMMENT_STORAGE_KEY);
      return true;
    } catch (error) {
      maLogger.error('清空留言失败:', error);
      return false;
    }
  }

  /**
   * 删除当前页面的所有留言
   */
  static async clearCommentsForCurrentPage(): Promise<boolean> {
    try {
      const comments = await this.getComments();
      const currentUrl = window.location.origin + window.location.pathname;
      const currentHash = this.getCurrentHash();
      
      const filteredComments = comments.filter(comment => {
        const commentUrl = comment.url.split('#')[0];
        const commentHash = comment.hash;
        
        return !(commentUrl === currentUrl && commentHash === currentHash);
      });
      
      await storage.ext.local.set(COMMENT_STORAGE_KEY, filteredComments);
      return true;
    } catch (error) {
      maLogger.error('清空当前页面留言失败:', error);
      return false;
    }
  }
}