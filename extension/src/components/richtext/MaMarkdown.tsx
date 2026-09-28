import { useEffect, useMemo, useState, type CSSProperties, type TextareaHTMLAttributes } from "react";
import MarkdownIt from "markdown-it";
import "./MaMarkdown.scss";

export interface MarkdownOptions {
  html?: boolean;
  linkify?: boolean;
  typographer?: boolean;
  [key: string]: unknown;
}

export type EditorMode = "split" | "preview" | "edit";

export interface MaMarkdownProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "onInput"> {
  value?: string;
  mode?: EditorMode;
  options?: MarkdownOptions;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

const defaultOptions: MarkdownOptions = {
  html: true,
  linkify: true,
  typographer: true,
};

const sanitizeMarkdownHtml = (html: string) => {
  const allowedTags = new Set([
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "p",
    "a",
    "img",
    "ul",
    "ol",
    "li",
    "code",
    "pre",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "strong",
    "em",
    "br",
    "hr",
    "div",
    "span",
  ]);

  return html.replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g, (match, tagName, attributes = "") => {
    const normalizedTag = tagName.toLowerCase();
    if (!allowedTags.has(normalizedTag)) {
      return "";
    }

    if (normalizedTag === "a") {
      const hrefMatch = attributes.match(/href=["'][^"']+["']/i);
      if (!hrefMatch && !attributes.includes("href")) {
        return match.startsWith("</") ? "</a>" : "<a>";
      }
    }

    return match;
  });
};

const MaMarkdown = ({
  value = "",
  mode = "split",
  options,
  onInput,
  onChange,
  className = "",
  style,
  ...props
}: MaMarkdownProps) => {
  const [markdownText, setMarkdownText] = useState(value);
  const mdRenderer = useMemo(
    () =>
      new MarkdownIt({
        ...defaultOptions,
        ...options,
      }),
    [options],
  );

  useEffect(() => {
    setMarkdownText((current) => (value !== current ? value : current));
  }, [value]);

  const previewHtml = useMemo(() => {
    if (!markdownText) return "";
    return sanitizeMarkdownHtml(mdRenderer.render(markdownText));
  }, [markdownText, mdRenderer]);

  const handleInput = (nextValue: string) => {
    setMarkdownText(nextValue);
    onInput?.(nextValue);
    onChange?.(nextValue);
  };

  const editor = (
    <textarea
      {...props}
      value={markdownText}
      className={`editor-textarea markdown-editor__textarea ${props.className ?? ""}`.trim()}
      placeholder="输入Markdown内容..."
      onChange={(event) => handleInput(event.target.value)}
      style={style}
    />
  );

  if (mode === "preview") {
    return (
      <div className={`markdown-editor ${className}`.trim()}>
        <div className="preview-only markdown-editor__preview-only">
          <div
            className="preview-content markdown-editor__preview-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className={`markdown-editor ${className}`.trim()}>
        {editor}
      </div>
    );
  }

  return (
    <div className={`markdown-editor ${className}`.trim()}>
      <div className="editor-container markdown-editor__container">
        <div className="editor-section markdown-editor__section">{editor}</div>
        <div className="preview-section markdown-editor__section">
          <div
            className="preview-content markdown-editor__preview-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
};

export default MaMarkdown;
