// 直接定义全局函数
export { };

interface Stack {
    Id: number;
    Env: Array<{ name: string; value: string }>;
    [key: string]: any;
}

interface StackFileResponse {
    StackFileContent: string;
}

// 扩展 Window 接口
declare global {
    interface Window {
        update_stacks: (old_ip: string, new_ip: string) => Promise<string>;
    }
}

(function () {
    window.update_stacks = async (old_ip: string, new_ip: string): Promise<string> => {
        // 参数验证
        if (old_ip === new_ip || !old_ip || !new_ip) {
            throw new Error(`Invalid IPs: ${!old_ip || !new_ip ? 'IPs cannot be empty' : 'IPs are the same'}`);
        }

        // 常量定义
        const addBackslash = (ip: string): string => ip.replaceAll('.', '\.');

        // 获取所有栈
        const stacksResponse = await fetch("api/stacks?filters=%7B%22EndpointID%22:3,%22IncludeOrphanedStacks%22:true%7D");
        const stacks: Stack[] = await stacksResponse.json();

        // 并行处理所有栈更新
        await Promise.all(stacks.map(async (stack: Stack) => {
            // 处理环境变量
            const envContent = JSON.stringify(stack.Env)
                .replaceAll(old_ip, new_ip)
                .replaceAll(addBackslash(old_ip), addBackslash(new_ip));
            const env = JSON.parse(envContent);

            // 获取文件内容和 CSRF token
            const res = await fetch(`api/stacks/${stack.Id}/file`);
            const { StackFileContent: fileContent } = await res.json() as StackFileResponse;

            // 更新栈
            await fetch(`api/stacks/${stack.Id}?endpointId=3`, {
                headers: {
                    "X-CSRF-Token": res.headers.get('X-CSRF-Token')!,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: stack.Id,
                    StackFileContent: String(fileContent),
                    Env: env,
                    Prune: false,
                    PullImage: false
                }),
                method: "PUT"
            });
        }));

        return "update stacks success";
    };
}());