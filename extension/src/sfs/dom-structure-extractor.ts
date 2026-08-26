/**
 * @author 她说喜欢窗外有树的房子
 * @version v1.0.0
 * @license MIT
 * @description 提取当前网页的 DOM 架构，生成适合 AI 理解的结构化摘要
 */

type DomStructurePrimitive = string | number | boolean | null;

interface DomStructureExtractorOptions {
  rootSelector?: string;
  maxDepth?: number;
  maxChildrenPerNode?: number;
  maxNodes?: number;
  maxTextLength?: number;
  includeHidden?: boolean;
  copyToClipboard?: boolean;
}

interface DomStructureNode {
  tag: string;
  id?: string;
  classes?: string[];
  role?: string;
  name?: string;
  text?: string;
  attrs?: Record<string, DomStructurePrimitive>;
  children?: DomStructureNode[];
  hidden?: boolean;
  omittedChildren?: number;
}

interface DomStructureSummary {
  page: {
    title: string;
    url: string;
    lang: string;
    description: string;
    canonical: string;
  };
  stats: {
    extractedNodes: number;
    omittedNodes: number;
    maxDepth: number;
  };
  landmarks: string[];
  headings: Array<{ level: number; text: string; id: string }>;
  images: Array<{ alt: string; src: string; id: string; title: string }>;
  forms: Array<{
    id: string;
    name: string;
    action: string;
    method: string;
    fields: Array<{
      tag: string;
      type: string;
      id: string;
      name: string;
      label: string;
      placeholder: string;
      required: boolean;
    }>;
  }>;
  dom: DomStructureNode | null;
  markdown: string;
}

interface DomStructureWindow extends Window {
  extractDomStructure?: (options?: DomStructureExtractorOptions) => DomStructureSummary;
  lastDomStructureSummary?: DomStructureSummary;
}

class DomStructureExtractor {
  private readonly defaultOptions: Required<DomStructureExtractorOptions> = {
    rootSelector: 'body',
    maxDepth: 8,
    maxChildrenPerNode: 24,
    maxNodes: 500,
    maxTextLength: 120,
    includeHidden: false,
    copyToClipboard: true
  };

  private options: Required<DomStructureExtractorOptions> = this.defaultOptions;
  private extractedNodes = 0;
  private omittedNodes = 0;

  extract(options: DomStructureExtractorOptions = {}): DomStructureSummary {
    this.options = { ...this.defaultOptions, ...options };
    this.extractedNodes = 0;
    this.omittedNodes = 0;

    const root = this.getRootElement();
    const dom = root ? this.extractElement(root, 0) : null;

    const summary: DomStructureSummary = {
      page: this.extractPageInfo(),
      stats: {
        extractedNodes: this.extractedNodes,
        omittedNodes: this.omittedNodes,
        maxDepth: this.options.maxDepth
      },
      landmarks: this.extractLandmarks(),
      headings: this.extractHeadings(),
      images: this.extractImages(),
      forms: this.extractForms(),
      dom,
      markdown: ''
    };

    summary.markdown = this.toMarkdown(summary);
    return summary;
  }

  shouldCopyToClipboard(): boolean {
    return this.options.copyToClipboard;
  }

  private getRootElement(): Element | null {
    try {
      return document.querySelector(this.options.rootSelector) || document.body || document.documentElement;
    } catch (error) {
      console.warn('DOM 结构提取：rootSelector 无效，已回退到 body', error);
      return document.body || document.documentElement;
    }
  }

  private extractPageInfo(): DomStructureSummary['page'] {
    return {
      title: document.title || '',
      url: window.location.href || '',
      lang: document.documentElement.lang || '',
      description: this.getMetaContent('description'),
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || ''
    };
  }

  private extractElement(element: Element, depth: number): DomStructureNode | null {
    if (this.shouldSkipElement(element)) {return null;}

    if (this.extractedNodes >= this.options.maxNodes) {
      this.omittedNodes += 1;
      return null;
    }

    const hidden = this.isHidden(element);
    if (hidden && !this.options.includeHidden) {return null;}

    this.extractedNodes += 1;

    const node: DomStructureNode = {
      tag: element.tagName.toLowerCase()
    };

    this.assignIdentity(node, element);
    this.assignText(node, element);
    this.assignAttributes(node, element);

    if (hidden) {node.hidden = true;}
    if (depth >= this.options.maxDepth) {
      const childElementCount = this.getVisibleChildren(element).length;
      if (childElementCount > 0) {
        node.omittedChildren = childElementCount;
        this.omittedNodes += childElementCount;
      }
      return node;
    }

    const children = this.getVisibleChildren(element);
    const limitedChildren = children.slice(0, this.options.maxChildrenPerNode);
    const extractedChildren = limitedChildren
      .map(child => this.extractElement(child, depth + 1))
      .filter((child): child is DomStructureNode => Boolean(child));

    if (extractedChildren.length > 0) {node.children = extractedChildren;}
    if (children.length > limitedChildren.length) {
      node.omittedChildren = children.length - limitedChildren.length;
      this.omittedNodes += node.omittedChildren;
    }

    return node;
  }

  private shouldSkipElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    return ['script', 'style', 'noscript', 'template', 'link', 'meta'].includes(tag);
  }

  private getVisibleChildren(element: Element): Element[] {
    return Array.from(element.children).filter(child => {
      if (this.shouldSkipElement(child)) {return false;}
      return this.options.includeHidden || !this.isHidden(child);
    });
  }

  private isHidden(element: Element): boolean {
    if (element.hasAttribute('hidden')) {return true;}
    if (element.getAttribute('aria-hidden') === 'true') {return true;}

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return true;
    }

    return false;
  }

  private assignIdentity(node: DomStructureNode, element: Element): void {
    const id = element.id.trim();
    const classes = Array.from(element.classList)
      .map(className => className.trim())
      .filter(Boolean)
      .slice(0, 6);
    const role = element.getAttribute('role') || '';
    const name = this.getAccessibleName(element);

    if (id) {node.id = id;}
    if (classes.length > 0) {node.classes = classes;}
    if (role) {node.role = role;}
    if (name) {node.name = this.truncate(name, this.options.maxTextLength);}
  }

  private assignText(node: DomStructureNode, element: Element): void {
    const directText = Array.from(element.childNodes)
      .filter(child => child.nodeType === Node.TEXT_NODE)
      .map(child => child.textContent || '')
      .join(' ');
    const normalized = this.normalizeText(directText);

    if (normalized) {node.text = this.truncate(normalized, this.options.maxTextLength);}
  }

  private assignAttributes(node: DomStructureNode, element: Element): void {
    const attrs: Record<string, DomStructurePrimitive> = {};
    const tag = element.tagName.toLowerCase();

    this.copyAttr(attrs, element, 'title');
    this.copyAttr(attrs, element, 'aria-label');
    this.copyAttr(attrs, element, 'aria-labelledby');
    this.copyAttr(attrs, element, 'data-testid');
    this.copyAttr(attrs, element, 'data-test');

    if (tag === 'a') {
      this.copyUrlAttr(attrs, element, 'href');
      this.copyAttr(attrs, element, 'target');
    }

    if (tag === 'img') {
      this.copyAttr(attrs, element, 'alt');
      this.copyUrlAttr(attrs, element, 'src');
      this.copyAttr(attrs, element, 'loading');
      attrs.width = (element as HTMLImageElement).naturalWidth || element.getAttribute('width') || null;
      attrs.height = (element as HTMLImageElement).naturalHeight || element.getAttribute('height') || null;
    }

    if (['button', 'input', 'select', 'textarea', 'form'].includes(tag)) {
      this.copyAttr(attrs, element, 'name');
      this.copyAttr(attrs, element, 'type');
      this.copyAttr(attrs, element, 'placeholder');
      this.copyUrlAttr(attrs, element, 'action');
      this.copyAttr(attrs, element, 'method');
      attrs.disabled = (element as HTMLButtonElement | HTMLInputElement).disabled || false;
      attrs.required = (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).required || false;
    }

    if (Object.keys(attrs).length > 0) {node.attrs = attrs;}
  }

  private extractLandmarks(): string[] {
    const selectors = [
      'header', 'nav', 'main', 'aside', 'footer', 'section', 'article',
      '[role="banner"]', '[role="navigation"]', '[role="main"]',
      '[role="complementary"]', '[role="contentinfo"]', '[role="search"]'
    ];

    return Array.from(document.querySelectorAll(selectors.join(',')))
      .filter(element => this.options.includeHidden || !this.isHidden(element))
      .slice(0, 40)
      .map(element => this.describeElement(element));
  }

  private extractHeadings(): DomStructureSummary['headings'] {
    return Array.from(document.querySelectorAll<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6'))
      .filter(heading => this.options.includeHidden || !this.isHidden(heading))
      .slice(0, 80)
      .map(heading => ({
        level: Number(heading.tagName.substring(1)),
        text: this.truncate(this.normalizeText(heading.innerText || heading.textContent || ''), 160),
        id: heading.id || ''
      }))
      .filter(heading => heading.text);
  }

  private extractImages(): DomStructureSummary['images'] {
    return Array.from(document.images)
      .filter(image => this.options.includeHidden || !this.isHidden(image))
      .slice(0, 80)
      .map(image => ({
        alt: image.alt || '',
        src: image.currentSrc || image.src || '',
        id: image.id || '',
        title: image.title || ''
      }))
      .filter(image => image.alt || image.title || image.id);
  }

  private extractForms(): DomStructureSummary['forms'] {
    return Array.from(document.forms).slice(0, 20).map(form => ({
      id: form.id || '',
      name: form.name || '',
      action: form.action || '',
      method: form.method || '',
      fields: Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select'))
        .filter(field => field.type !== 'hidden')
        .slice(0, 60)
        .map(field => ({
          tag: field.tagName.toLowerCase(),
          type: field.type || '',
          id: field.id || '',
          name: field.name || '',
          label: this.getFieldLabel(field),
          placeholder: this.getFieldPlaceholder(field),
          required: field.required || false
        }))
    }));
  }

  private getAccessibleName(element: Element): string {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {return this.normalizeText(ariaLabel);}

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map(id => document.getElementById(id)?.textContent || '')
        .join(' ');
      if (text.trim()) {return this.normalizeText(text);}
    }

    if (element instanceof HTMLImageElement) {return this.normalizeText(element.alt || element.title || '');}
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return this.getFieldLabel(element) || this.normalizeText(this.getFieldPlaceholder(element));
    }

    if (element instanceof HTMLButtonElement || element.tagName.toLowerCase() === 'a') {
      return this.normalizeText(element.textContent || element.getAttribute('title') || '');
    }

    return '';
  }

  private getFieldLabel(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
    if (field.id) {
      const label = document.querySelector<HTMLLabelElement>(`label[for="${this.escapeSelectorValue(field.id)}"]`);
      if (label?.innerText) {return this.normalizeText(label.innerText);}
    }

    const parentLabel = field.closest('label');
    if (parentLabel?.textContent) {return this.normalizeText(parentLabel.textContent);}

    return this.normalizeText(field.getAttribute('aria-label') || this.getFieldPlaceholder(field) || '');
  }

  private getFieldPlaceholder(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      return field.placeholder || '';
    }

    return field.getAttribute('placeholder') || '';
  }

  private describeElement(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const role = element.getAttribute('role') ? `[role="${element.getAttribute('role')}"]` : '';
    const name = this.getAccessibleName(element);
    return `${tag}${id}${role}${name ? ` - ${this.truncate(name, 80)}` : ''}`;
  }

  private toMarkdown(summary: DomStructureSummary): string {
    const lines: string[] = [];

    lines.push('# DOM 结构摘要');
    lines.push('');
    lines.push('## 页面信息');
    lines.push(`- title: ${summary.page.title || '(无)'}`);
    lines.push(`- url: ${summary.page.url}`);
    if (summary.page.lang) {lines.push(`- lang: ${summary.page.lang}`);}
    if (summary.page.description) {lines.push(`- description: ${summary.page.description}`);}
    if (summary.page.canonical) {lines.push(`- canonical: ${summary.page.canonical}`);}
    lines.push(`- extractedNodes: ${summary.stats.extractedNodes}`);
    if (summary.stats.omittedNodes > 0) {lines.push(`- omittedNodes: ${summary.stats.omittedNodes}`);}
    lines.push('');

    if (summary.landmarks.length > 0) {
      lines.push('## 语义区块');
      summary.landmarks.forEach(landmark => lines.push(`- ${landmark}`));
      lines.push('');
    }

    if (summary.headings.length > 0) {
      lines.push('## 标题层级');
      summary.headings.forEach(heading => {
        lines.push(`${'  '.repeat(Math.max(heading.level - 1, 0))}- h${heading.level}: ${heading.text}${heading.id ? ` (#${heading.id})` : ''}`);
      });
      lines.push('');
    }

    if (summary.images.length > 0) {
      lines.push('## 图片关键信息');
      summary.images.slice(0, 30).forEach(image => {
        const label = image.alt || image.title || image.id;
        lines.push(`- ${label}${image.id ? ` (#${image.id})` : ''}`);
      });
      lines.push('');
    }

    if (summary.forms.length > 0) {
      lines.push('## 表单');
      summary.forms.forEach((form, index) => {
        lines.push(`- form ${index + 1}: ${form.id || form.name || form.method || '(未命名)'}`);
        form.fields.forEach(field => {
          const label = field.label || field.placeholder || field.name || field.id || field.type || field.tag;
          lines.push(`  - ${field.tag}${field.type ? `[type="${field.type}"]` : ''}: ${label}${field.required ? ' (required)' : ''}`);
        });
      });
      lines.push('');
    }

    lines.push('## DOM 树');
    if (summary.dom) {
      this.writeNode(lines, summary.dom, 0);
    } else {
      lines.push('(未提取到 DOM)');
    }

    return lines.join('\n');
  }

  private writeNode(lines: string[], node: DomStructureNode, depth: number): void {
    const parts = [node.tag];
    if (node.id) {parts.push(`#${node.id}`);}
    if (node.classes?.length) {parts.push(`.${node.classes.join('.')}`);}
    if (node.role) {parts.push(`[role="${node.role}"]`);}
    if (node.name) {parts.push(`name="${node.name}"`);}
    if (node.text) {parts.push(`text="${node.text}"`);}
    if (node.attrs) {
      Object.entries(node.attrs).forEach(([key, value]) => {
        if (value !== '' && value !== false && value !== null) {
          parts.push(`${key}="${String(value)}"`);
        }
      });
    }

    lines.push(`${'  '.repeat(depth)}- ${parts.join(' ')}`);
    node.children?.forEach(child => this.writeNode(lines, child, depth + 1));
    if (node.omittedChildren) {
      lines.push(`${'  '.repeat(depth + 1)}- ... omitted ${node.omittedChildren} children`);
    }
  }

  private getMetaContent(name: string): string {
    return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || '';
  }

  private copyAttr(attrs: Record<string, DomStructurePrimitive>, element: Element, attrName: string): void {
    const value = element.getAttribute(attrName);
    if (value) {attrs[attrName] = this.truncate(this.normalizeText(value), 200);}
  }

  private copyUrlAttr(attrs: Record<string, DomStructurePrimitive>, element: Element, attrName: string): void {
    const value = element.getAttribute(attrName);
    if (!value) {return;}

    const absoluteValue = attrName in element ? String((element as unknown as Record<string, unknown>)[attrName] || value) : value;
    attrs[attrName] = this.truncate(absoluteValue, 300);
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {return text;}
    return `${text.slice(0, Math.max(maxLength - 1, 0))}…`;
  }

  private escapeSelectorValue(value: string): string {
    if (window.CSS?.escape) {return window.CSS.escape(value);}
    return value.replace(/["\\]/g, '\\$&');
  }
}

(() => {
  'use strict';

  const extractor = new DomStructureExtractor();
  const extractDomStructure = (options?: DomStructureExtractorOptions) => extractor.extract(options);
  const result = extractDomStructure();

  (window as DomStructureWindow).extractDomStructure = extractDomStructure;
  (window as DomStructureWindow).lastDomStructureSummary = result;

  console.log(result.markdown);
  console.log('DOM 结构 JSON:', result);

  if (extractor.shouldCopyToClipboard() && navigator.clipboard && result.markdown) {
    navigator.clipboard.writeText(result.markdown).catch(error => {
      console.warn('DOM 结构提取：无法自动复制到剪贴板', error);
    });
  }
})();
