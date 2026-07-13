import { defineManifest } from '@crxjs/vite-plugin'

function generateContentScripts() {
  return [{
    matches: ['*://*/*'],
    js: ['content/main'],
    run_at: 'document_start',
    "all_frames": true,
  }]
}

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_pluginName__',
  version: '1.0.10',
  description: '__MSG_pluginDesc__',
  default_locale: 'zh_CN',

  icons: {
    16: 'static/icons/favicon16.ico' as never,
    48: 'static/icons/favicon48.ico' as never,
    128: 'static/icons/favicon128.ico' as never,
  },

  action: {
    default_title: '配置项',
    default_popup: 'pages/popup.html' as never,
    default_icon: {
      16: 'static/icons/favicon16.ico' as never,
      48: 'static/icons/favicon48.ico' as never,
      128: 'static/icons/favicon128.ico' as never,
    },
  },
  //@ts-ignore chrome dev版本
  // automation: {
  //   "desktop": false,     // 是否获取桌面级应用（非网页部分）
  //   "interact": true      // 是否允许交互操作（点击、设置值等）
  // },

  side_panel: {
    default_path: 'pages/sidepanel.html',
  },

  options_page: 'pages/options.html' as never,

  devtools_page: "pages/devtools.html" as never,

  background: {
    service_worker: 'service-worker/background',
    type: 'module',
  },

  content_scripts: [...generateContentScripts()],

  web_accessible_resources: [
    {
      resources: [
        'assets/js/runtime/*.js',
        'assets/js/*.js',
        'assets/css/*.css',
        'static/wasm/*.js',
        'static/wasm/*.wasm',
        'static/icons/*.ico',
        'static/icons/*.png',
        'static/img/*.png',
        'static/keytone/Piano/*.wav',
        'static/fonts/*',
        'static/css/*.css',
        'pages/devtools/*.html',
        'pages/devtools/*.js',
        "*.json",
        "ExtensionToolPrompt.md"
      ],
      matches: ['*://*/*'],
    },
  ],

  permissions: [
    'declarativeNetRequest',
    'declarativeNetRequestWithHostAccess',
    'scripting',
    'tabs',
    'activeTab',
    'downloads',
    'storage',
    'contextMenus',
    'cookies',
    'sidePanel',
    'webNavigation',
    // "automation"
  ],
  host_permissions: ['<all_urls>'],

  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
  },
});
