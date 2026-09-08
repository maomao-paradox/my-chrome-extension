// QuickLogin.tsx
import React, { useState } from "react";
import quickLoginCss from "./style.scss?inline";

// 类型定义
interface UserInfo {
  realname: string;
  password: string;
  role: string;
  enabled: boolean;
}

export interface QuickLoginProps {
  userList?: Record<string, UserInfo>;
  onLogin?: (username: string, password: string) => void;
  customClass?: string;
}

// 默认用户列表
const defaultUserList: Record<string, UserInfo> = {
  mpadmin: {
    realname: "超级管理员",
    password: "admin123",
    role: "管理员",
    enabled: true,
  },
};

const QuickLogin: React.FC<QuickLoginProps> = ({
  userList = defaultUserList,
  onLogin,
  customClass = "",
}) => {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  // 处理选择变化
  const handleSelectChange = (username: string) => {
    setSelectedUser(username);
    setIsOpen(false);

    const user = userList[username];
    if (user) {
      // 调用传入的回调
      if (onLogin && typeof onLogin === "function") {
        onLogin(username, user.password);
      } else {
        // 默认使用 chrome.runtime.sendMessage
        chrome.runtime.sendMessage(
          {
            type: "quickLogin",
            payload: {
              username: username,
              password: user.password,
            },
            target: "background",
          },
          (response) => {
            // 处理响应
            console.log("登录响应:", response);
          },
        );
      }
    }
  };

  // 获取当前选中的用户
  const selectedUserInfo = selectedUser ? userList[selectedUser] : null;

  // 获取所有用户名
  const usernames = Object.keys(userList);

  return (
    <>
      {/* 直接插入 CSS 到模板中 */}
      <style>{quickLoginCss}</style>
      <div className={`quick-login-wrapper ${customClass}`}>
        <div className="custom-select" role="combobox" aria-expanded={isOpen}>
          {/* 选择框触发器 */}
          <div className="select-trigger" onClick={() => setIsOpen(!isOpen)}>
            <span className="select-value">
              {selectedUserInfo ? (
                <span className="user-label">
                  <span className="user-role">[{selectedUserInfo.role}]</span>
                  <span className="user-name">{selectedUserInfo.realname}</span>
                </span>
              ) : (
                <span className="placeholder">快捷切换账号</span>
              )}
            </span>
            <span className={`select-arrow ${isOpen ? "open" : ""}`}>▼</span>
          </div>

          {/* 下拉列表 */}
          {isOpen && (
            <ul className="select-dropdown">
              {usernames.map((username) => {
                const user = userList[username];
                const isDisabled = !user.enabled;
                const isSelected = selectedUser === username;

                return (
                  <li
                    key={username}
                    className={`
                    select-option 
                    ${isDisabled ? "disabled" : ""}
                    ${isSelected ? "selected" : ""}
                  `}
                    onClick={() => {
                      if (!isDisabled) {
                        handleSelectChange(username);
                      }
                    }}
                  >
                    <span className="option-label">
                      <span className="option-role">[{user.role}]</span>
                      <span className="option-name">{user.realname}</span>
                    </span>
                    {isDisabled && <span className="option-badge">已禁用</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default QuickLogin;
