/**
 * 页面内容提取器 - 专为大模型设计
 * 输出：页面有什么 + 用户可以做什么
 */
class PageContentExtractor {
  constructor() {
    // 需要忽略的容器选择器（这些区域通常不是主要内容）
    this.ignoreSelectors = [
      'nav', '.nav', '.navbar', '.sidebar', '.menu',
      'header', 'footer', '.header', '.footer',
      '.ads', '.advertisement', '.banner',
      '.toast', '.notification', '.modal-backdrop'
    ];
  }
  
  /**
   * 获取元素的直接文本（不包括子元素的文本）
   * @param {HTMLElement|null} element - DOM元素
   * @returns {string} 直接文本内容
   */
  getDirectText(element) {
    // 修复：如果元素为 null 或 undefined，返回空字符串
    if (!element) {return '';}
    if (element.nodeType !== Node.ELEMENT_NODE) {return '';}
    
    let text = '';
    try {
      for (const node of element.childNodes) {
        if (node && node.nodeType === Node.TEXT_NODE) {
          const nodeText = node.textContent?.trim() || '';
          if (nodeText) {text += nodeText;}
        }
      }
    } catch (e) {
      console.warn('获取直接文本失败:', e);
    }
    return text;
  }
  
  /**
   * 判断元素是否应该被忽略
   */
  shouldIgnore(element) {
    if (!element) {return true;}
    
    // 检查选择器
    for (const selector of this.ignoreSelectors) {
      try {
        if (element.matches && element.matches(selector)) {
          return true;
        }
      } catch (e) {
        // 选择器可能无效，跳过
      }
    }
    
    // 检查类名
    const className = element.className;
    if (typeof className === 'string') {
      const lowerClass = className.toLowerCase();
      if (lowerClass.includes('nav') || lowerClass.includes('menu') || 
          lowerClass.includes('sidebar') || lowerClass.includes('header') ||
          lowerClass.includes('footer')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 提取主要内容（纯文本）
   */
  extractMainText() {
    try {
      // 1. 尝试找主要内容容器
      let mainContainer = null;
      
      const mainSelectors = [
        'main', 'article', '[role="main"]',
        '.main-content', '.content', '.page-content',
        '#app', '#root', '#main'
      ];
      
      for (const selector of mainSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.innerText && el.innerText.length > 100) {
            mainContainer = el;
            break;
          }
        } catch (e) {
          // 选择器可能无效，跳过
        }
      }
      
      if (!mainContainer) {
        mainContainer = document.body;
      }
      
      // 2. 克隆并移除干扰元素
      let clone;
      try {
        clone = mainContainer.cloneNode(true);
        this.ignoreSelectors.forEach(selector => {
          try {
            clone.querySelectorAll(selector).forEach(el => el && el.remove());
          } catch (e) {
            // 选择器可能无效，跳过
          }
        });
      } catch (e) {
        console.warn('克隆元素失败:', e);
        clone = document.body.cloneNode(true);
      }
      
      // 3. 获取文本并清理
      let text = '';
      try {
        text = clone.innerText || clone.textContent || '';
      } catch (e) {
        text = '';
      }
      
      text = text.replace(/\s+/g, ' ')
        .replace(/[\n\r\t]+/g, ' ')
        .trim();
      
      // 4. 按段落分割
      const paragraphs = text.split(/[。！？；\n]{2,}/).filter(p => p && p.length > 20);
      
      return {
        fullText: text,
        paragraphs: paragraphs.slice(0, 20),
        length: text.length
      };
    } catch (error) {
      console.error('提取主要内容失败:', error);
      return {
        fullText: '',
        paragraphs: [],
        length: 0
      };
    }
  }
  
  /**
   * 提取所有可交互元素
   */
  extractInteractiveElements() {
    const elements = {
      buttons: [],
      links: [],
      inputs: [],
      selects: []
    };
    
    try {
      // 提取按钮
      document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').forEach(btn => {
        try {
          const text = btn.innerText?.trim() || btn.value?.trim() || btn.getAttribute('aria-label') || '';
          if (text && text.length < 100) {
            elements.buttons.push({
              text: text,
              disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true'
            });
          }
        } catch (e) {
          // 忽略单个按钮的错误
        }
      });
      
      // 提取链接
      document.querySelectorAll('a[href]').forEach(link => {
        try {
          const text = link.innerText?.trim();
          const href = link.href;
          if (text && text.length < 100 && href && !href.includes('javascript:')) {
            elements.links.push({
              text: text,
              href: href
            });
          }
        } catch (e) {
          // 忽略单个链接的错误
        }
      });
      
      // 提取输入框
      document.querySelectorAll('input:not([type="hidden"]), textarea').forEach(input => {
        try {
          const label = this.getInputLabel(input);
          const placeholder = input.placeholder || '';
          const value = input.value || '';
          
          elements.inputs.push({
            type: input.type || 'text',
            label: label,
            placeholder: placeholder,
            value: value ? value.substring(0, 50) : null,
            required: input.required || false,
            disabled: input.disabled || false
          });
        } catch (e) {
          // 忽略单个输入框的错误
        }
      });
      
      // 提取下拉框
      document.querySelectorAll('select').forEach(select => {
        try {
          const label = this.getInputLabel(select);
          const options = Array.from(select.options || [])
            .map(opt => opt.text)
            .filter(t => t && t.length > 0);
          
          elements.selects.push({
            label: label,
            options: options.slice(0, 10),
            selected: select.value || '',
            disabled: select.disabled || false
          });
        } catch (e) {
          // 忽略单个下拉框的错误
        }
      });
    } catch (error) {
      console.error('提取交互元素失败:', error);
    }
    
    return elements;
  }
  
  /**
   * 获取输入框的标签
   */
  getInputLabel(input) {
    if (!input) {return '';}
    
    try {
      // 通过 for 属性
      if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) {
          const labelText = label.innerText?.trim();
          if (labelText) {return labelText;}
        }
      }
      
      // 通过父级 label
      const parentLabel = input.closest('label');
      if (parentLabel) {
        const labelText = parentLabel.innerText?.trim();
        if (labelText) {return labelText;}
      }
      
      // 通过 aria-label
      const ariaLabel = input.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.trim()) {return ariaLabel.trim();}
      
      // 通过 placeholder
      if (input.placeholder && input.placeholder.trim()) {return input.placeholder.trim();}
      
      // 通过相邻文本（修复：检查元素是否存在）
      const prevElement = input.previousElementSibling;
      if (prevElement) {
        const prevText = this.getDirectText(prevElement);
        if (prevText && prevText.trim()) {return prevText.trim();}
      }
      
      // 通过父级文本（作为后备）
      const parentText = this.getDirectText(input.parentElement);
      if (parentText && parentText.length < 50) {return parentText.trim();}
      
    } catch (e) {
      console.warn('获取输入框标签失败:', e);
    }
    
    return '';
  }
  
  /**
   * 提取表格数据
   */
  extractTables() {
    const tables = [];
    
    try {
      document.querySelectorAll('table, [role="table"]').forEach(table => {
        try {
          const headers = [];
          const rows = [];
          
          // 提取表头
          table.querySelectorAll('th, [role="columnheader"]').forEach(th => {
            const text = th.innerText?.trim();
            if (text) {headers.push(text);}
          });
          
          // 提取数据行（限制数量）
          const bodyRows = table.querySelectorAll('tbody tr, [role="row"]');
          bodyRows.forEach((row, idx) => {
            if (idx >= 10) {return;} // 最多10行
            
            const rowData = [];
            row.querySelectorAll('td, [role="cell"]').forEach(cell => {
              const text = cell.innerText?.trim();
              if (text) {rowData.push(text);}
            });
            if (rowData.length > 0) {rows.push(rowData);}
          });
          
          if (headers.length > 0 || rows.length > 0) {
            tables.push({
              headers: headers,
              rows: rows.slice(0, 20),
              rowCount: bodyRows.length
            });
          }
        } catch (e) {
          // 忽略单个表格的错误
        }
      });
    } catch (error) {
      console.error('提取表格失败:', error);
    }
    
    return tables;
  }
  
  /**
   * 提取标题结构
   */
  extractHeadings() {
    const headings = [];
    
    try {
      for (let i = 1; i <= 6; i++) {
        document.querySelectorAll(`h${i}`).forEach(h => {
          try {
            const text = h.innerText?.trim();
            if (text && text.length > 0 && text.length < 200) {
              headings.push({
                level: i,
                text: text
              });
            }
          } catch (e) {
            // 忽略单个标题的错误
          }
        });
      }
    } catch (error) {
      console.error('提取标题失败:', error);
    }
    
    return headings;
  }
  
  /**
   * 提取列表
   */
  extractLists() {
    const lists = [];
    
    try {
      document.querySelectorAll('ul, ol').forEach(list => {
        try {
          const items = [];
          list.querySelectorAll('li').forEach(li => {
            const text = li.innerText?.trim();
            if (text && text.length < 200 && text.length > 0) {
              items.push(text);
            }
          });
          
          if (items.length > 0) {
            lists.push({
              type: list.tagName.toLowerCase(),
              items: items.slice(0, 20)
            });
          }
        } catch (e) {
          // 忽略单个列表的错误
        }
      });
    } catch (error) {
      console.error('提取列表失败:', error);
    }
    
    return lists;
  }
  
  /**
   * 提取卡片/区块（常见于现代 UI）
   */
  extractCards() {
    const cards = [];
    
    try {
      // 常见卡片选择器
      const cardSelectors = [
        '.card', '.item', '.post', '.article',
        '[class*="card"]', '[class*="item"]'
      ];
      
      document.querySelectorAll(cardSelectors.join(',')).forEach(card => {
        try {
          const title = card.querySelector('h1, h2, h3, h4, .title, [class*="title"]')?.innerText?.trim();
          const description = card.querySelector('p, .desc, [class*="desc"]')?.innerText?.trim();
          const image = card.querySelector('img')?.src;
          
          if (title || description) {
            cards.push({
              title: title?.substring(0, 100),
              description: description?.substring(0, 200),
              hasImage: !!image
            });
          }
        } catch (e) {
          // 忽略单个卡片的错误
        }
      });
    } catch (error) {
      console.error('提取卡片失败:', error);
    }
    
    return cards.slice(0, 30);
  }
  
  /**
   * 生成大模型友好的摘要
   */
  generateLLMPrompt() {
    const headings = this.extractHeadings();
    const text = this.extractMainText();
    const interactive = this.extractInteractiveElements();
    const tables = this.extractTables();
    const lists = this.extractLists();
    const cards = this.extractCards();
    
    let prompt = '# 页面内容摘要\n\n';
    
    // 页面信息
    prompt += '## 页面信息\n';
    prompt += `- 标题: ${document.title || '无标题'}\n`;
    prompt += `- URL: ${window.location.href}\n`;
    prompt += `- 文本总长度: ${text.length} 字符\n\n`;
    
    // 标题结构
    if (headings.length > 0) {
      prompt += '## 页面结构\n';
      headings.forEach(h => {
        prompt += `${'#'.repeat(h.level)} ${h.text}\n`;
      });
      prompt += '\n';
    }
    
    // 主要内容（最重要）
    prompt += '## 主要内容\n';
    if (text.paragraphs.length > 0) {
      text.paragraphs.forEach(p => {
        prompt += `${p}\n\n`;
      });
    } else if (text.fullText.length > 0) {
      prompt += `${text.fullText.substring(0, 2000)}\n\n`;
      if (text.fullText.length > 2000) {
        prompt += `...(内容已截断，共 ${text.fullText.length} 字符)\n\n`;
      }
    } else {
      prompt += '(未检测到文本内容)\n\n';
    }
    
    // 可操作元素
    const hasButtons = interactive.buttons.length > 0;
    const hasLinks = interactive.links.length > 0;
    const hasInputs = interactive.inputs.length > 0;
    const hasSelects = interactive.selects.length > 0;
    
    if (hasButtons || hasLinks || hasInputs || hasSelects) {
      prompt += '## 可操作元素\n';
      
      if (hasButtons) {
        prompt += `### 按钮 (${interactive.buttons.length}个)\n`;
        interactive.buttons.slice(0, 20).forEach(btn => {
          prompt += `- [按钮] ${btn.text}${btn.disabled ? ' (禁用)' : ''}\n`;
        });
        prompt += '\n';
      }
      
      if (hasLinks) {
        prompt += `### 链接 (${interactive.links.length}个)\n`;
        interactive.links.slice(0, 15).forEach(link => {
          prompt += `- [链接] ${link.text}\n`;
        });
        prompt += '\n';
      }
      
      if (hasInputs) {
        prompt += `### 输入框 (${interactive.inputs.length}个)\n`;
        interactive.inputs.slice(0, 10).forEach(input => {
          let desc = `- [输入框] ${input.label || input.placeholder || input.type}`;
          if (input.required) {desc += ' (必填)';}
          if (input.value) {desc += `: ${input.value}`;}
          prompt += `${desc}\n`;
        });
        prompt += '\n';
      }
      
      if (hasSelects) {
        prompt += `### 下拉框 (${interactive.selects.length}个)\n`;
        interactive.selects.slice(0, 5).forEach(select => {
          prompt += `- [下拉框] ${select.label}: ${select.options.slice(0, 5).join(', ')}${select.options.length > 5 ? '...' : ''}\n`;
        });
        prompt += '\n';
      }
    }
    
    // 表格数据
    if (tables.length > 0) {
      prompt += `## 数据表格 (${tables.length}个)\n`;
      tables.forEach((table, idx) => {
        prompt += `### 表格 ${idx + 1}\n`;
        if (table.headers.length > 0) {
          prompt += `列: ${table.headers.join(' | ')}\n`;
        }
        if (table.rows.length > 0) {
          prompt += `数据行数: ${table.rowCount} (显示前 ${table.rows.length} 行)\n`;
          table.rows.slice(0, 5).forEach(row => {
            prompt += `- ${row.join(' | ')}\n`;
          });
        }
        prompt += '\n';
      });
    }
    
    // 列表
    if (lists.length > 0) {
      prompt += '## 列表内容\n';
      lists.slice(0, 5).forEach(list => {
        list.items.slice(0, 10).forEach(item => {
          prompt += `- ${item}\n`;
        });
        if (list.items.length > 10) {prompt += `- ... 共 ${list.items.length} 项\n`;}
        prompt += '\n';
      });
    }
    
    // 卡片（常见于现代 UI）
    if (cards.length > 0) {
      prompt += `## 内容卡片 (${cards.length}个)\n`;
      cards.slice(0, 10).forEach(card => {
        if (card.title) {prompt += `### ${card.title}\n`;}
        if (card.description) {prompt += `${card.description}\n`;}
        prompt += '\n';
      });
    }
    
    return prompt;
  }
  
  /**
   * 执行完整提取
   */
  extract() {
    try {
      return {
        pageInfo: {
          title: document.title || '',
          url: window.location.href || '',
          description: document.querySelector('meta[name="description"]')?.content || ''
        },
        content: {
          fullText: this.extractMainText().fullText,
          headings: this.extractHeadings(),
          paragraphs: this.extractMainText().paragraphs
        },
        interactive: this.extractInteractiveElements(),
        tables: this.extractTables(),
        lists: this.extractLists(),
        cards: this.extractCards(),
        llmPrompt: this.generateLLMPrompt()
      };
    } catch (error) {
      console.error('提取页面内容失败:', error);
      return {
        pageInfo: { title: '', url: '', description: '' },
        content: { fullText: '', headings: [], paragraphs: [] },
        interactive: { buttons: [], links: [], inputs: [], selects: [] },
        tables: [],
        lists: [],
        cards: [],
        llmPrompt: '# 提取失败\n\n无法提取页面内容，请检查页面是否正常加载。'
      };
    }
  }
}

// ============= 使用 =============

const extractor = new PageContentExtractor();
const result = extractor.extract();

// 打印大模型提示词（这是最有用的输出）
console.log(result.llmPrompt);

// 复制到剪贴板
(async () => {
  try {
    await navigator.clipboard.writeText(result.llmPrompt);
    console.log('\n✅ 已复制到剪贴板，可以直接粘贴给大模型！');
  } catch (e) {
    console.log('\n⚠️ 无法自动复制，请手动复制上面的内容');
  }
})();

// 也可以查看其他数据
console.log('\n=== 统计 ===');
console.log(`文本长度: ${result.content.fullText.length}`);
console.log(`标题数: ${result.content.headings.length}`);
console.log(`按钮数: ${result.interactive.buttons.length}`);
console.log(`链接数: ${result.interactive.links.length}`);
console.log(`输入框: ${result.interactive.inputs.length}`);
console.log(`表格数: ${result.tables.length}`);