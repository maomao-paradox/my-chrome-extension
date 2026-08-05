/**
 * @description 确认对话框组件
 */
import React from 'react';
import { Modal } from 'antd';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      open={visible}
      title={title}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="确认"
      cancelText="取消"
      centered
    >
      <p>{message}</p>
    </Modal>
  );
};
