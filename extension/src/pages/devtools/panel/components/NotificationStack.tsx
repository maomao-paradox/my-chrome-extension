/**
 * @description 通知栈组件
 */
import React from 'react';
import type { NotificationItem } from '../types';

interface NotificationStackProps {
  notifications: NotificationItem[];
}

export const NotificationStack: React.FC<NotificationStackProps> = ({ notifications }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="notification-stack">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification ${notification.type}`}
        >
          <div className="notification-title">{notification.title}</div>
          <div className="notification-message">{notification.message}</div>
        </div>
      ))}
    </div>
  );
};
