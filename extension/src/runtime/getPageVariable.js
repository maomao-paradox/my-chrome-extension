!function () {
  const varPath = window.localStorage.getItem('env_config_path');
  // 安全地尝试获取变量
  let value;
  try {
    value = eval(varPath);
  } catch (e) {
    console.log('变量获取失败: ' + e.message);
    return;
  }
  // 序列化复杂对象，确保可以安全传递
  try {
    // 字符串类型
    if (typeof value === 'string') {
      window.sessionStorage.setItem('env_config_value', value);
    } else if (typeof value === 'object') {
      window.sessionStorage.setItem('env_config_value', JSON.stringify(value));
    } else {
      window.sessionStorage.setItem('env_config_value', value);
    }
  } catch (e) {
    console.log('变量序列化失败: ' + e.message);
  }
}();