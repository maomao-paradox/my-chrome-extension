/**
 * @author 她说喜欢窗外有树的房子
 * @version v1.0.0
 * @license MIT
 * @description 执行内联脚本
 */

(() => {
  'use strict';
  const scriptStr = sessionStorage.getItem('js-code');
  sessionStorage.removeItem('js-code');
  if (!scriptStr) {return;}

  const script = document.createElement('script');
  Object.assign(script, {
    innerHTML: scriptStr,
    async: true,
    defer: true,
    crossOrigin: 'anonymous'
  });

  document.body.appendChild(script);

  setTimeout(() => {
    if (document.body.contains(script)) {
      // console.log('Removing script after execution');
      script.remove();
    }
  }, 100);
})();