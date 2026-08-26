/**
 * 移除 Web 限制，包括事件限制、DOM 0 事件限制、CSS 限制等
 * @author The Hanged Man
 * @version 1.0.0
 * @license MIT
 */
(function () {
  'use strict';
  // 域名规则列表
  const rules = {
    black_rule: {
      name: 'black',
      hook_eventNames: '',
      unhook_eventNames: ''
    },
    default_rule: {
      name: 'default',
      hook_eventNames: 'contextmenu|select|selectstart|copy|cut|dragstart',
      unhook_eventNames: 'mousedown|mouseup|keydown|keyup',
      dom0: true,
      hook_addEventListener: true,
      hook_preventDefault: true,
      hook_set_returnValue: true,
      add_css: true
    }
  };
    // 域名列表
  const lists = {
    // 黑名单
    black_list: [
      /.*\\.youtube\\.com.*/,
      /.*\\.wikipedia\\.org.*/,
      /mail\\.qq\\.com.*/,
      /translate\\.google\\..*/
    ]
  };
    // 要处理的 event 列表
  let hook_eventNames, unhook_eventNames, eventNames;
  // 储存名称
  const storageName = getRandStr('qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM', Math.floor(Math.random() * 12 + 8));
  // 储存被 Hook 的函数
  const EventTarget_addEventListener = EventTarget.prototype.addEventListener;
  const document_addEventListener = document.addEventListener;
  const Event_preventDefault = Event.prototype.preventDefault;
  // Hook addEventListener proc
  function addEventListener(type, func, useCapture) {
    const _addEventListener = this === document ? document_addEventListener : EventTarget_addEventListener;
    if (hook_eventNames.indexOf(type) >= 0) {
      _addEventListener.apply(this, [type, returnTrue, useCapture]);
    }
    else if (this && unhook_eventNames.indexOf(type) >= 0) {
      const funcsName = storageName + type + (useCapture ? 't' : 'f');
      if (this[funcsName] === undefined) {
        this[funcsName] = [];
        _addEventListener.apply(this, [type, useCapture ? unhook_t : unhook_f, useCapture]);
      }
      this[funcsName].push(func);
    }
    else {
      _addEventListener.apply(this, arguments);
    }
  }
  // 清理循环
  function clearLoop() {
    const elements = getElements();
    for (const i in elements) {
      for (const j in eventNames) {
        const name = 'on' + eventNames[j];
        if (elements[i][name] !== null && elements[i][name] !== onxxx) {
          if (unhook_eventNames.indexOf(eventNames[j]) >= 0) {
            elements[i][storageName + name] = elements[i][name];
            elements[i][name] = onxxx;
          }
          else {
            elements[i][name] = null;
          }
        }
      }
    }
  }
  // 返回true的函数
  function returnTrue(e) { return true; }
  function unhook_t(e) { return unhook(e, this, storageName + e.type + 't'); }
  function unhook_f(e) { return unhook(e, this, storageName + e.type + 'f'); }
  function unhook(e, self, funcsName) {
    const list = self[funcsName];
    for (const i in list) { list[i](e); }
    e.returnValue = true; return true;
  }
  function onxxx(e) {
    const name = storageName + 'on' + e.type;
    this[name](e);
    e.returnValue = true;
    return true;
  }
  // 获取随机字符串
  function getRandStr(chs, len) {
    let str = '';
    while (len--) {
      str += chs[Math.floor(Math.random() * chs.length)];
    }
    return str;
  }
  // 获取所有元素 包括document
  function getElements() {
    const elements = Array.prototype.slice.call(document.getElementsByTagName('*'));
    elements.push(document);
    return elements;
  }
  // 添加css
  function addStyle(css) {
    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
  }
  // 获取目标域名应该使用的规则
  function getRule(url) {
    function testUrl(list, url) {
      for (const i in list) {
        if (list[i].test(url)) { return true; }
      }
      return false;
    }
    if (testUrl(lists.black_list, url)) {
      return rules.black_rule;
    }
    return rules.default_rule;
  }
  // 初始化
  function init() {
    // 获取当前域名的规则
    const url = window.location.host + window.location.pathname;
    const rule = getRule(url);
    // 设置 event 列表
    hook_eventNames = rule.hook_eventNames.split('|');
    // TODO Allowed to return value
    unhook_eventNames = rule.unhook_eventNames.split('|');
    eventNames = hook_eventNames.concat(unhook_eventNames);
    // 调用清理 DOM0 event 方法的循环
    if (rule.dom0) {
      setInterval(clearLoop, 30 * 1000);
      setTimeout(clearLoop, 2500);
      window.addEventListener('load', clearLoop, true); clearLoop();
    }
    // hook addEventListener
    if (rule.hook_addEventListener) {
      EventTarget.prototype.addEventListener = addEventListener;
      document.addEventListener = addEventListener;
    }
    // hook preventDefault
    if (rule.hook_preventDefault) {
      Event.prototype.preventDefault = function () {
        if (eventNames.indexOf(this.type) < 0) {
          Event_preventDefault.apply(this, arguments);
        }
      };
    }
    // Hook set returnValue
    if (rule.hook_set_returnValue) {
      Event.prototype.__defineSetter__('returnValue', function () {
        if (this.returnValue !== true && eventNames.indexOf(this.type) >= 0) { this.returnValue = true; }
      });
    }
    console.debug('url: ' + url, 'storageName：' + storageName, 'rule: ' + rule.name);
    // 添加CSS
    if (rule.add_css) {
      addStyle('html, * {-webkit-user-select:text!important; -moz-user-select:text!important; user-select:text!important; -ms-user-select:text!important; -khtml-user-select:text!important;}');
    }
  }
  init();
  Object.defineProperty(window, 'The Hanged Man', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false
  });
})();