alert('hello world');
// 打印当前页面的cookie（在网页环境中）
console.log('🍪 当前网站的cookie:', document.cookie);

// 解析成对象方便查看
const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
  const [key, value] = cookie.split('=');
  acc[key] = value;
  return acc;
}, {});
console.table(cookies);