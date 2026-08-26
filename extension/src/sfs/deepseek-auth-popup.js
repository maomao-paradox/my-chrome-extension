!(function () {
  "use strict";

  const STYLE_ID = "deepseek-auth-popup-style";
  const ROOT_ID = "deepseek-auth-popup-root";

  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const mount = document.createElement("div");
  mount.id = ROOT_ID;
  mount.setAttribute("role", "dialog");
  mount.setAttribute("aria-modal", "true");
  mount.setAttribute("aria-label", "第三方登录授权");

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.46);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
    }

    #${ROOT_ID} .deepseek-auth-mask {
      position: absolute;
      inset: 0;
    }

    #${ROOT_ID} .deepseek-auth-panel {
      position: relative;
      width: min(420px, calc(100vw - 32px));
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(240, 244, 248, 0.96));
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
      overflow: hidden;
    }

    #${ROOT_ID} .deepseek-auth-panel::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 28%),
        radial-gradient(circle at top left, rgba(45, 212, 191, 0.1), transparent 24%);
      pointer-events: none;
    }

    #${ROOT_ID} .deepseek-auth-head,
    #${ROOT_ID} .deepseek-auth-body,
    #${ROOT_ID} .deepseek-auth-foot {
      position: relative;
      z-index: 1;
    }

    #${ROOT_ID} .deepseek-auth-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }

    #${ROOT_ID} .deepseek-auth-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    #${ROOT_ID} .deepseek-auth-mark {
      width: 40px;
      height: 40px;
      flex: 0 0 auto;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: #0f172a;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(45, 212, 191, 0.18));
      font-weight: 700;
      letter-spacing: 0;
    }

    #${ROOT_ID} .deepseek-auth-title {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      color: #0f172a;
    }

    #${ROOT_ID} .deepseek-auth-subtitle {
      margin: 4px 0 0;
      font-size: 12px;
      line-height: 1.4;
      color: #64748b;
    }

    #${ROOT_ID} .deepseek-auth-close {
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.06);
      color: #334155;
      cursor: pointer;
      transition: background-color 160ms ease, color 160ms ease;
    }

    #${ROOT_ID} .deepseek-auth-close:hover {
      background: rgba(15, 23, 42, 0.1);
      color: #0f172a;
    }

    #${ROOT_ID} .deepseek-auth-body {
      padding: 18px 20px 20px;
    }

    #${ROOT_ID} .deepseek-auth-intro {
      margin: 0 0 14px;
      color: #475569;
      font-size: 14px;
      line-height: 1.6;
    }

    #${ROOT_ID} .deepseek-auth-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
      padding: 14px 16px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.92);
      cursor: pointer;
      transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
    }

    #${ROOT_ID} .deepseek-auth-option:hover {
      border-color: rgba(14, 165, 233, 0.28);
      background: rgba(14, 165, 233, 0.06);
      transform: translateY(-1px);
    }

    #${ROOT_ID} .deepseek-auth-option-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    #${ROOT_ID} .deepseek-auth-icon {
      width: 36px;
      height: 36px;
      flex: 0 0 auto;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(45, 212, 191, 0.14));
      color: #0284c7;
      font-weight: 700;
    }

    #${ROOT_ID} .deepseek-auth-option-title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
    }

    #${ROOT_ID} .deepseek-auth-option-desc {
      margin: 4px 0 0;
      font-size: 12px;
      color: #64748b;
    }

    #${ROOT_ID} .deepseek-auth-badge {
      flex: 0 0 auto;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      color: #0369a1;
      background: rgba(14, 165, 233, 0.12);
    }

    #${ROOT_ID} .deepseek-auth-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 20px 18px;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
      color: #64748b;
      font-size: 12px;
    }

    @media (max-width: 480px) {
      #${ROOT_ID} .deepseek-auth-head,
      #${ROOT_ID} .deepseek-auth-body,
      #${ROOT_ID} .deepseek-auth-foot {
        padding-left: 16px;
        padding-right: 16px;
      }

      #${ROOT_ID} .deepseek-auth-option {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `;

  const panel = document.createElement("div");
  panel.className = "deepseek-auth-panel";
  panel.innerHTML = `
    <div class="deepseek-auth-head">
      <div class="deepseek-auth-brand">
        <div class="deepseek-auth-mark">D</div>
        <div>
          <h2 class="deepseek-auth-title">第三方登录授权</h2>
          <p class="deepseek-auth-subtitle">选择一个账号服务继续</p>
        </div>
      </div>
      <button class="deepseek-auth-close" type="button" aria-label="关闭">×</button>
    </div>
    <div class="deepseek-auth-body">
      <p class="deepseek-auth-intro">当前仅提供一个可登录选项，点击后请由你自己补充后续处理逻辑。</p>
      <button class="deepseek-auth-option" type="button" data-provider="deepseek">
        <span class="deepseek-auth-option-left">
          <span class="deepseek-auth-icon">D</span>
          <span>
            <span class="deepseek-auth-option-title">DeepSeek</span>
            <span class="deepseek-auth-option-desc">使用 DeepSeek 账号继续</span>
          </span>
        </span>
        <span class="deepseek-auth-badge">可登录</span>
      </button>
    </div>
    <div class="deepseek-auth-foot">
      <span>仅用于页面内授权展示</span>
      <span>单文件脚本</span>
    </div>
  `;

  const cleanup = () => {
    document.removeEventListener("keydown", handleKeydown, true);
    mount.remove();
    style.remove();
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      cleanup();
    }
  };

  const handleMaskClick = () => cleanup();

  const handleProviderClick = () => {
    // 这里留空，按需补充你的登录逻辑
  };

  const handleCloseClick = () => cleanup();

  mount.appendChild(style);
  mount.appendChild(panel);
  document.body.appendChild(mount);

  mount.addEventListener("click", (event) => {
    if (event.target === mount) {
      handleMaskClick();
    }
  });

  panel
    .querySelector(".deepseek-auth-close")
    ?.addEventListener("click", handleCloseClick);
  panel
    .querySelector(".deepseek-auth-option")
    ?.addEventListener("click", handleProviderClick);
  document.addEventListener("keydown", handleKeydown, true);
})();
