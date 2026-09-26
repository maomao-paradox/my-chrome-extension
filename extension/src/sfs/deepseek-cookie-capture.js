(() => {
  "use strict";

  const allowedHost = 'chat.deepseek.com';
  const resultKey = '__deepseekCookieCaptureResult__';

  if (location.hostname !== allowedHost) {
    globalThis[resultKey] = {
      success: false,
      error: `Cookie capture is only allowed on ${allowedHost}`
    };
  } else {
    globalThis[resultKey] = {
      success: true,
      url: location.href,
      cookies: document.cookie,
      auth_token: JSON.parse(localStorage.getItem("userToken")).value
    };
  }

  const result = globalThis[resultKey];
  delete globalThis[resultKey];
  return result;
})();
