/**
 * Static404.tsx - React 版 404 占位组件
 * 从 Vue 版 response-code/Static404.vue 迁移而来
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import { useId } from "react";
import { ArrowLeft } from "lucide-react";
import "./Static404.scss";

interface Static404Props {
  /** 返回按钮回调（可选，默认不显示）*/
  onGoBack?: () => void;
}

/**
 * Static404 - 404 页面占位组件
 */
const Static404: React.FC<Static404Props> = ({ onGoBack }) => {
  const headingId = useId();

  return (
    <section className="static-404" aria-labelledby={headingId}>
      <header className="static-404__topline">
        <span className="static-404__route">
          <span className="static-404__signal" aria-hidden="true" />
          ROUTE / ERROR
        </span>
        <span className="static-404__status">
          HTTP STATUS <strong>404</strong>
        </span>
      </header>

      <div className="static-404__main">
        <div className="static-404__visual" aria-hidden="true">
          <span className="static-404__index">ERR / 04</span>
          <span className="static-404__code">404</span>
          <span className="static-404__visual-line" />
        </div>

        <div className="static-404__copy">
          <p className="static-404__eyebrow">PAGE NOT FOUND</p>
          <h1 id={headingId}>
            这条路径
            <br />
            <span>暂时不通。</span>
          </h1>
          <p className="static-404__description">
            你请求的页面可能已移动、失效，或地址输入有误。
          </p>
        {onGoBack && (
            <button className="static-404__button" type="button" onClick={onGoBack}>
              <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>返回上一页</span>
          </button>
        )}
        </div>
      </div>

      <footer className="static-404__footer">
        <span>REQUEST TERMINATED</span>
        <span>CHECK THE ADDRESS AND TRY AGAIN</span>
      </footer>
    </section>
  );
};

Static404.displayName = "Static404";

export default Static404;
