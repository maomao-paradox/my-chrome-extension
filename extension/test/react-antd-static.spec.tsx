/**
 * @file test/react-antd-static.spec.tsx
 * @description antd 静态方法在 React 19 下的兼容回归测试
 * —— 依赖入口引入 @ant-design/v5-patch-for-react-19，这里直接引入补丁模拟
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { Button, Modal, message } from "antd";
import "@ant-design/v5-patch-for-react-19";

describe("antd 静态方法（React 19 补丁生效）", () => {
    it("Modal.confirm 点击后应渲染出确认弹窗", async () => {
        render(
            <Button
                data-testid="open"
                onClick={() => Modal.confirm({ title: "迁移确认", content: "内容" })}
            >
                打开
            </Button>,
        );
        fireEvent.click(document.querySelector('[data-testid="open"]')!);
        await waitFor(() => {
            expect(document.body.textContent).toContain("迁移确认");
        });
    });

    it("message.success 调用后应渲染出提示", async () => {
        render(
            <Button data-testid="toast" onClick={() => message.success("成功提示")}>
                提示
            </Button>,
        );
        fireEvent.click(document.querySelector('[data-testid="toast"]')!);
        await waitFor(() => {
            expect(document.body.textContent).toContain("成功提示");
        });
    });
});
