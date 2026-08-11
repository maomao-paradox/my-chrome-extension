import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import QuickLogin from "./QuickLogin";

// Mock chrome.runtime.sendMessage
const mockSendMessage = jest.fn();
global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
  },
} as any;

describe("QuickLogin 组件单元测试", () => {
  // 每个测试前重置 mock
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  // ==================== 基础渲染测试 ====================

  describe("基础渲染", () => {
    test("应该正确渲染组件", () => {
      render(<QuickLogin />);

      expect(screen.getByText("快捷切换账号")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    test("应该应用自定义 CSS 类名", () => {
      const customClass = "my-custom-class";
      render(<QuickLogin customClass={customClass} />);

      const wrapper = screen
        .getByText("快捷切换账号")
        .closest(".quick-login-wrapper");
      expect(wrapper).toHaveClass(customClass);
    });

    test("应该使用默认用户列表", () => {
      render(<QuickLogin />);

      // 点击触发器展开下拉
      const trigger = screen.getByText("快捷切换账号");
      fireEvent.click(trigger);

      expect(screen.getByText("[管理员]")).toBeInTheDocument();
      expect(screen.getByText("超级管理员")).toBeInTheDocument();
    });
  });

  // ==================== 下拉菜单交互测试 ====================

  describe("下拉菜单交互", () => {
    test("点击触发器应该展开/收起下拉列表", async () => {
      const user = userEvent.setup();
      render(<QuickLogin />);

      const trigger = screen.getByText("快捷切换账号");

      // 初始状态：下拉列表不可见
      expect(screen.queryByRole("list")).not.toBeInTheDocument();

      // 点击展开
      await user.click(trigger);
      expect(screen.getByRole("list")).toBeInTheDocument();

      // 再次点击收起
      await user.click(trigger);
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    test("点击用户选项应该触发登录", async () => {
      const user = userEvent.setup();
      const mockOnLogin = jest.fn();

      render(<QuickLogin onLogin={mockOnLogin} />);

      // 展开下拉
      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      // 点击用户选项
      const userOption = screen.getByText("超级管理员");
      await user.click(userOption);

      // 验证回调被调用
      expect(mockOnLogin).toHaveBeenCalledWith("mpadmin", "admin123");
      expect(mockOnLogin).toHaveBeenCalledTimes(1);
    });

    test("选择用户后下拉列表应该自动关闭", async () => {
      const user = userEvent.setup();
      render(<QuickLogin />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      expect(screen.getByRole("list")).toBeInTheDocument();

      const userOption = screen.getByText("超级管理员");
      await user.click(userOption);

      await waitFor(() => {
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
      });
    });

    test("选中的用户应该高亮显示", async () => {
      const user = userEvent.setup();
      render(<QuickLogin />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const option = screen.getByText("超级管理员").closest("li");
      expect(option).toHaveClass("selected");
    });
  });

  // ==================== 用户列表测试 ====================

  describe("用户列表功能", () => {
    const customUserList = {
      admin: {
        realname: "管理员",
        password: "admin123",
        role: "超级管理员",
        enabled: true,
      },
      guest: {
        realname: "访客用户",
        password: "guest123",
        role: "访客",
        enabled: false,
      },
      editor: {
        realname: "编辑人员",
        password: "editor123",
        role: "编辑",
        enabled: true,
      },
    };

    test("应该使用自定义用户列表", async () => {
      const user = userEvent.setup();
      render(<QuickLogin userList={customUserList} />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      expect(screen.getByText("[超级管理员]")).toBeInTheDocument();
      expect(screen.getByText("[访客]")).toBeInTheDocument();
      expect(screen.getByText("[编辑]")).toBeInTheDocument();
    });

    test("禁用的用户应该显示禁用状态且不可点击", async () => {
      const user = userEvent.setup();
      const mockOnLogin = jest.fn();

      render(<QuickLogin userList={customUserList} onLogin={mockOnLogin} />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const guestOption = screen.getByText("访客用户").closest("li");
      expect(guestOption).toHaveClass("disabled");

      // 点击禁用的用户
      await user.click(screen.getByText("访客用户"));

      // 验证登录回调没有被调用
      expect(mockOnLogin).not.toHaveBeenCalled();
    });

    test("应该显示'已禁用'标记", async () => {
      const user = userEvent.setup();
      render(<QuickLogin userList={customUserList} />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      expect(screen.getByText("已禁用")).toBeInTheDocument();
    });
  });

  // ==================== 回调函数测试 ====================

  describe("回调函数测试", () => {
    test("onLogin 回调应该被正确调用", async () => {
      const user = userEvent.setup();
      const mockOnLogin = jest.fn();

      render(<QuickLogin onLogin={mockOnLogin} />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const userOption = screen.getByText("超级管理员");
      await user.click(userOption);

      expect(mockOnLogin).toHaveBeenCalledWith("mpadmin", "admin123");
    });

    test("onLogin 回调应该传递正确的用户名和密码", async () => {
      const user = userEvent.setup();
      const mockOnLogin = jest.fn();

      const customUserList = {
        testuser: {
          realname: "测试用户",
          password: "testpass123",
          role: "测试员",
          enabled: true,
        },
      };

      render(<QuickLogin userList={customUserList} onLogin={mockOnLogin} />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const userOption = screen.getByText("测试用户");
      await user.click(userOption);

      expect(mockOnLogin).toHaveBeenCalledWith("testuser", "testpass123");
    });
  });

  // ==================== Chrome Extension API 测试 ====================

  describe("Chrome Extension API 测试", () => {
    test("当 onLogin 未提供时，应该使用 chrome.runtime.sendMessage", async () => {
      const user = userEvent.setup();
      mockSendMessage.mockImplementation((message, callback) => {
        callback({ success: true });
      });

      render(<QuickLogin />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const userOption = screen.getByText("超级管理员");
      await user.click(userOption);

      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: "quickLogin",
          payload: {
            username: "mpadmin",
            password: "admin123",
          },
          target: "background",
        },
        expect.any(Function),
      );
    });

    test("chrome.runtime.sendMessage 应该处理响应", async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      mockSendMessage.mockImplementation((message, callback) => {
        callback({ success: true, data: { token: "fake-token" } });
      });

      render(<QuickLogin />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const userOption = screen.getByText("超级管理员");
      await user.click(userOption);

      expect(consoleSpy).toHaveBeenCalledWith("登录响应:", {
        success: true,
        data: { token: "fake-token" },
      });

      consoleSpy.mockRestore();
    });

    test("当 onLogin 存在时，不应该调用 chrome.runtime.sendMessage", async () => {
      const user = userEvent.setup();
      const mockOnLogin = jest.fn();

      render(<QuickLogin onLogin={mockOnLogin} />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const userOption = screen.getByText("超级管理员");
      await user.click(userOption);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  // ==================== 边界情况测试 ====================

  describe("边界情况", () => {
    test("空用户列表应该显示占位符", () => {
      render(<QuickLogin userList={{}} />);

      expect(screen.getByText("快捷切换账号")).toBeInTheDocument();

      const trigger = screen.getByText("快捷切换账号");
      fireEvent.click(trigger);

      // 下拉列表应该是空的
      expect(screen.queryByRole("list")).toBeInTheDocument();
      expect(screen.queryByText("[管理员]")).not.toBeInTheDocument();
    });

    test("当用户被选中时，显示用户信息而不是占位符", async () => {
      const user = userEvent.setup();
      render(<QuickLogin />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const userOption = screen.getByText("超级管理员");
      await user.click(userOption);

      // 验证显示选中的用户信息
      expect(screen.getByText("[管理员]")).toBeInTheDocument();
      expect(screen.getByText("超级管理员")).toBeInTheDocument();
      expect(screen.queryByText("快捷切换账号")).not.toBeInTheDocument();
    });

    test("处理 undefined 用户列表", () => {
      render(<QuickLogin userList={undefined} />);

      expect(screen.getByText("快捷切换账号")).toBeInTheDocument();
    });

    test("处理 onLogin 为 undefined", async () => {
      const user = userEvent.setup();
      render(<QuickLogin onLogin={undefined} />);

      const trigger = screen.getByText("快捷切换账号");
      await user.click(trigger);

      const userOption = screen.getByText("超级管理员");
      await user.click(userOption);

      // 应该使用 chrome.runtime.sendMessage
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });

  // ==================== 样式和状态测试 ====================

  describe("样式和状态", () => {
    test("下拉箭头应该在展开时旋转", async () => {
      const user = userEvent.setup();
      render(<QuickLogin />);

      const trigger = screen.getByText("快捷切换账号");
      const arrow = trigger.querySelector(".select-arrow");

      expect(arrow).not.toHaveClass("open");

      await user.click(trigger);
      expect(arrow).toHaveClass("open");

      await user.click(trigger);
      expect(arrow).not.toHaveClass("open");
    });

    test("aria-expanded 属性应该正确更新", async () => {
      const user = userEvent.setup();
      render(<QuickLogin />);

      const combobox = screen.getByRole("combobox");

      expect(combobox).toHaveAttribute("aria-expanded", "false");

      await user.click(combobox);
      expect(combobox).toHaveAttribute("aria-expanded", "true");

      await user.click(combobox);
      expect(combobox).toHaveAttribute("aria-expanded", "false");
    });
  });
});
