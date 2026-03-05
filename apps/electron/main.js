// WinClaw Desktop Shell - Electron Main Process
// Replaces C#/WebView2 WinClawUI.exe with a lightweight Electron wrapper.

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  shell,
  dialog,
  ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile, spawn } = require("child_process");
const http = require("http");

// ── Constants ──────────────────────────────────────────────────────
const APP_NAME = "WinClaw";
const DEFAULT_PORT = 18789;
const HEALTH_CHECK_INTERVAL_MS = 2000;
const MAX_HEALTH_RETRIES = 30; // 60 seconds max wait

// ── i18n ─────────────────────────────────────────────────────────
const i18nStrings = {
  en: {
    file: "File",
    edit: "Edit",
    view: "View",
    window: "Window",
    help: "Help",
    about: `About ${APP_NAME}`,
    quit: `Quit ${APP_NAME}`,
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    selectAll: "Select All",
    reload: "Reload",
    forceReload: "Force Reload",
    devTools: "Toggle Developer Tools",
    resetZoom: "Actual Size",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    fullscreen: "Toggle Full Screen",
    minimize: "Minimize",
    close: "Close Window",
    showWinclaw: `Show ${APP_NAME}`,
    restartGateway: "Restart Gateway",
    openInBrowser: "Open in Browser",
    exit: "Exit",
    gatewayLabel: "Gateway",
    learnMore: "Learn More",
    documentation: "Documentation",
    reportIssue: "Report Issue",
  },
  ja: {
    file: "ファイル",
    edit: "編集",
    view: "表示",
    window: "ウィンドウ",
    help: "ヘルプ",
    about: `${APP_NAME} について`,
    quit: `${APP_NAME} を終了`,
    undo: "元に戻す",
    redo: "やり直し",
    cut: "切り取り",
    copy: "コピー",
    paste: "貼り付け",
    selectAll: "すべて選択",
    reload: "再読み込み",
    forceReload: "強制再読み込み",
    devTools: "開発者ツールの切替",
    resetZoom: "実際のサイズ",
    zoomIn: "拡大",
    zoomOut: "縮小",
    fullscreen: "フルスクリーン切替",
    minimize: "最小化",
    close: "ウィンドウを閉じる",
    showWinclaw: `${APP_NAME} を表示`,
    restartGateway: "ゲートウェイを再起動",
    openInBrowser: "ブラウザで開く",
    exit: "終了",
    gatewayLabel: "ゲートウェイ",
    learnMore: "詳細情報",
    documentation: "ドキュメント",
    reportIssue: "問題を報告",
  },
  "zh-CN": {
    file: "文件",
    edit: "编辑",
    view: "视图",
    window: "窗口",
    help: "帮助",
    about: `关于 ${APP_NAME}`,
    quit: `退出 ${APP_NAME}`,
    undo: "撤销",
    redo: "重做",
    cut: "剪切",
    copy: "复制",
    paste: "粘贴",
    selectAll: "全选",
    reload: "重新加载",
    forceReload: "强制重新加载",
    devTools: "切换开发者工具",
    resetZoom: "实际大小",
    zoomIn: "放大",
    zoomOut: "缩小",
    fullscreen: "切换全屏",
    minimize: "最小化",
    close: "关闭窗口",
    showWinclaw: `显示 ${APP_NAME}`,
    restartGateway: "重启网关",
    openInBrowser: "在浏览器中打开",
    exit: "退出",
    gatewayLabel: "网关",
    learnMore: "了解更多",
    documentation: "文档",
    reportIssue: "报告问题",
  },
  "zh-TW": {
    file: "檔案",
    edit: "編輯",
    view: "檢視",
    window: "視窗",
    help: "說明",
    about: `關於 ${APP_NAME}`,
    quit: `結束 ${APP_NAME}`,
    undo: "復原",
    redo: "重做",
    cut: "剪下",
    copy: "複製",
    paste: "貼上",
    selectAll: "全選",
    reload: "重新載入",
    forceReload: "強制重新載入",
    devTools: "切換開發者工具",
    resetZoom: "實際大小",
    zoomIn: "放大",
    zoomOut: "縮小",
    fullscreen: "切換全螢幕",
    minimize: "最小化",
    close: "關閉視窗",
    showWinclaw: `顯示 ${APP_NAME}`,
    restartGateway: "重新啟動閘道",
    openInBrowser: "在瀏覽器中開啟",
    exit: "結束",
    gatewayLabel: "閘道",
    learnMore: "瞭解更多",
    documentation: "文件",
    reportIssue: "回報問題",
  },
  ko: {
    file: "파일",
    edit: "편집",
    view: "보기",
    window: "창",
    help: "도움말",
    about: `${APP_NAME} 정보`,
    quit: `${APP_NAME} 종료`,
    undo: "실행 취소",
    redo: "다시 실행",
    cut: "잘라내기",
    copy: "복사",
    paste: "붙여넣기",
    selectAll: "모두 선택",
    reload: "새로고침",
    forceReload: "강제 새로고침",
    devTools: "개발자 도구 전환",
    resetZoom: "실제 크기",
    zoomIn: "확대",
    zoomOut: "축소",
    fullscreen: "전체 화면 전환",
    minimize: "최소화",
    close: "창 닫기",
    showWinclaw: `${APP_NAME} 표시`,
    restartGateway: "게이트웨이 재시작",
    openInBrowser: "브라우저에서 열기",
    exit: "종료",
    gatewayLabel: "게이트웨이",
    learnMore: "더 알아보기",
    documentation: "문서",
    reportIssue: "문제 신고",
  },
};

function resolveLocale() {
  const sysLocale = app.getLocale(); // e.g. "ja", "zh-CN", "en-US"
  if (i18nStrings[sysLocale]) return sysLocale;
  const lang = sysLocale.split("-")[0];
  // zh without region → default to zh-CN
  if (lang === "zh") return "zh-CN";
  if (i18nStrings[lang]) return lang;
  return "en";
}

function t(key) {
  const locale = resolveLocale();
  return i18nStrings[locale]?.[key] || i18nStrings.en[key] || key;
}

// ── Single Instance Lock ──────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ── Globals ───────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let gatewayPort = DEFAULT_PORT;
let gatewayToken = "";
let gatewayProcess = null;
let isQuitting = false;

// ── Resolve Install Directory ─────────────────────────────────────
// When packaged: <installDir>/desktop/winclaw.exe → installDir is parent of "desktop"
// When dev: apps/electron/ → use project root
function resolveInstallDir() {
  if (app.isPackaged) {
    // Packaged: <installDir>/desktop/winclaw.exe → parent of "desktop" is installDir
    return path.resolve(path.dirname(app.getPath("exe")), "..");
  }
  // Dev mode: assume running from apps/electron/
  return path.resolve(__dirname, "..", "..");
}

const installDir = resolveInstallDir();

// ── Config Resolution ─────────────────────────────────────────────
function resolveGatewayConfig() {
  // Priority: env var > config file > defaults
  const port =
    parseInt(process.env.WINCLAW_GATEWAY_PORT, 10) || loadConfigPort() || DEFAULT_PORT;
  const token = process.env.WINCLAW_GATEWAY_TOKEN || loadConfigToken() || "";
  return { port, token };
}

function loadConfigFile() {
  const candidates = [
    path.join(os.homedir(), ".winclaw", "winclaw.json"),
    path.join(os.homedir(), ".winclaw", "winclaw.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    } catch {
      // try next
    }
  }
  return {};
}

function loadConfigPort() {
  const cfg = loadConfigFile();
  return cfg?.gateway?.port || cfg?.server?.port || 0;
}

function loadConfigToken() {
  const cfg = loadConfigFile();
  return cfg?.gateway?.auth?.token || cfg?.gateway?.token || cfg?.server?.token || "";
}

// ── Gateway Health Check ──────────────────────────────────────────
function checkGatewayHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForGateway(port, maxRetries = MAX_HEALTH_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    const ok = await checkGatewayHealth(port);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL_MS));
    updateTrayStatus("Starting...");
  }
  return false;
}

// ── Gateway Process Management ────────────────────────────────────
function findNodeExe() {
  // Electron v33 embeds Node 20.x but winclaw requires Node >= 22.12.
  // Prefer system Node.js which the user installed at the correct version.
  const { execFileSync } = require("child_process");
  // Try nvm4w / volta / standard node from PATH
  try {
    const nodePath = execFileSync("where", ["node"], {
      encoding: "utf-8",
      windowsHide: true,
      timeout: 5000,
    })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)[0];
    if (nodePath && fs.existsSync(nodePath)) {
      console.log("[gateway] Found system node:", nodePath);
      return nodePath;
    }
  } catch {
    // 'where' failed — no node in PATH
  }
  // Fallback: Electron's own Node.js (may fail version check)
  console.warn("[gateway] System node not found, falling back to Electron node");
  return process.execPath;
}

function startGateway() {
  const appEntry = path.join(installDir, "app", "winclaw.mjs");

  if (!fs.existsSync(appEntry)) {
    console.error("[gateway] winclaw.mjs not found at:", installDir);
    return null;
  }

  const nodeExe = findNodeExe();
  const useElectronNode = nodeExe === process.execPath;
  const args = [appEntry, "gateway", "--port", String(gatewayPort)];
  console.log("[gateway] Spawning:", nodeExe, args.join(" "));

  const env = { ...process.env };
  if (useElectronNode) {
    env.ELECTRON_RUN_AS_NODE = "1";
  }

  const child = spawn(nodeExe, args, {
    cwd: installDir,
    stdio: "ignore",
    detached: true,
    windowsHide: true,
    env,
  });

  child.unref(); // Allow Electron to exit without killing gateway
  child.on("error", (err) => {
    console.error("[gateway] Spawn error:", err.message);
  });

  return child;
}

// ── Tray Icon ─────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(installDir, "assets", "winclaw.ico");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  updateTrayMenu("Starting...");

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function updateTrayStatus(status) {
  if (tray) {
    tray.setToolTip(`${APP_NAME} - Gateway: ${status}`);
    updateTrayMenu(status);
  }
}

function updateTrayMenu(gatewayStatus) {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: t("showWinclaw"),
      type: "normal",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: `${t("gatewayLabel")}: ${gatewayStatus}`,
      enabled: false,
    },
    {
      label: t("restartGateway"),
      click: () => restartGateway(),
    },
    {
      label: t("openInBrowser"),
      click: () => {
        const url = buildGatewayUrl();
        shell.openExternal(url);
      },
    },
    { type: "separator" },
    {
      label: t("exit"),
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

// ── Application Menu ──────────────────────────────────────────────
function getMenuTemplate() {
  return [
    {
      label: t("file"),
      submenu: [
        {
          label: t("reload"),
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow) mainWindow.webContents.reload();
          },
        },
        {
          label: t("forceReload"),
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => {
            if (mainWindow) mainWindow.webContents.reloadIgnoringCache();
          },
        },
        { type: "separator" },
        {
          label: t("openInBrowser"),
          click: () => shell.openExternal(buildGatewayUrl()),
        },
        { type: "separator" },
        {
          label: t("quit"),
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: t("edit"),
      submenu: [
        { label: t("undo"), role: "undo", accelerator: "CmdOrCtrl+Z" },
        { label: t("redo"), role: "redo", accelerator: "CmdOrCtrl+Shift+Z" },
        { type: "separator" },
        { label: t("cut"), role: "cut", accelerator: "CmdOrCtrl+X" },
        { label: t("copy"), role: "copy", accelerator: "CmdOrCtrl+C" },
        { label: t("paste"), role: "paste", accelerator: "CmdOrCtrl+V" },
        { type: "separator" },
        { label: t("selectAll"), role: "selectAll", accelerator: "CmdOrCtrl+A" },
      ],
    },
    {
      label: t("view"),
      submenu: [
        {
          label: t("resetZoom"),
          role: "resetZoom",
          accelerator: "CmdOrCtrl+0",
        },
        { label: t("zoomIn"), role: "zoomIn", accelerator: "CmdOrCtrl+=" },
        { label: t("zoomOut"), role: "zoomOut", accelerator: "CmdOrCtrl+-" },
        { type: "separator" },
        {
          label: t("fullscreen"),
          role: "togglefullscreen",
          accelerator: "F11",
        },
        { type: "separator" },
        {
          label: t("devTools"),
          accelerator: "F12",
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: t("window"),
      submenu: [
        { label: t("minimize"), role: "minimize" },
        {
          label: t("close"),
          accelerator: "CmdOrCtrl+W",
          click: () => {
            if (mainWindow) mainWindow.close();
          },
        },
        { type: "separator" },
        {
          label: t("restartGateway"),
          click: () => restartGateway(),
        },
      ],
    },
    {
      label: t("help"),
      submenu: [
        {
          label: t("documentation"),
          click: () => shell.openExternal("https://github.com/nicepkg/winclaw"),
        },
        {
          label: t("reportIssue"),
          click: () =>
            shell.openExternal("https://github.com/nicepkg/winclaw/issues"),
        },
        { type: "separator" },
        {
          label: t("about"),
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: t("about"),
              message: APP_NAME,
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode.js: ${process.versions.node}`,
            });
          },
        },
      ],
    },
  ];
}

function createAppMenu() {
  // Set the application menu (keeps keyboard shortcuts working) but hide the bar
  const menu = Menu.buildFromTemplate(getMenuTemplate());
  Menu.setApplicationMenu(menu);
}

// ── Hamburger Menu (IPC popup) ───────────────────────────────────
function setupHamburgerMenu() {
  ipcMain.on("show-app-menu", (_event, { x, y }) => {
    const menu = Menu.buildFromTemplate(getMenuTemplate());
    menu.popup({ window: mainWindow, x: Math.round(x), y: Math.round(y) });
  });
}

function injectHamburgerButton() {
  if (!mainWindow) return;
  mainWindow.webContents.executeJavaScript(`
    (function() {
      if (document.getElementById('winclaw-hamburger')) return;

      // Inject CSS to shift brand area right, making room for hamburger
      var style = document.createElement('style');
      style.id = 'winclaw-hamburger-style';
      style.textContent = '.brand { margin-left: 28px !important; }';
      document.head.appendChild(style);

      // Create hamburger button
      var btn = document.createElement('button');
      btn.id = 'winclaw-hamburger';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3.5" width="12" height="1.4" rx="0.7"/><rect x="2" y="7.3" width="12" height="1.4" rx="0.7"/><rect x="2" y="11.1" width="12" height="1.4" rx="0.7"/></svg>';
      btn.title = 'Menu';
      var s = btn.style;
      s.position = 'fixed';
      s.top = '10px';
      s.left = '10px';
      s.zIndex = '999999';
      s.width = '24px';
      s.height = '24px';
      s.border = 'none';
      s.borderRadius = '4px';
      s.background = 'transparent';
      s.color = '#888';
      s.cursor = 'pointer';
      s.display = 'flex';
      s.alignItems = 'center';
      s.justifyContent = 'center';
      s.padding = '0';
      s.transition = 'background 0.15s, color 0.15s';
      btn.addEventListener('mouseenter', function() {
        s.background = 'rgba(0,0,0,0.06)';
        s.color = '#555';
      });
      btn.addEventListener('mouseleave', function() {
        s.background = 'transparent';
        s.color = '#888';
      });
      btn.addEventListener('click', function(e) {
        var rect = btn.getBoundingClientRect();
        if (window.winclaw && window.winclaw.showMenu) {
          window.winclaw.showMenu(Math.round(rect.left), Math.round(rect.bottom + 2));
        }
      });
      document.body.appendChild(btn);
    })();
  `).catch(() => {});
}

// ── Main Window ───────────────────────────────────────────────────
function buildGatewayUrl() {
  const base = `http://127.0.0.1:${gatewayPort}/`;
  return gatewayToken ? `${base}#token=${gatewayToken}` : base;
}

function createMainWindow() {
  const iconPath = path.join(installDir, "assets", "winclaw.ico");

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 600,
    minHeight: 400,
    title: APP_NAME,
    icon: iconPath,
    show: false, // Show after gateway is ready
    autoHideMenuBar: true, // Hide menu bar (Alt key still toggles it)
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Hide the menu bar completely on show
  mainWindow.setMenuBarVisibility(false);

  // Close-to-tray behavior
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Navigation guard: keep internal URLs in window, external in browser
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (
      !url.startsWith(`http://127.0.0.1:${gatewayPort}`) &&
      !url.startsWith(`http://localhost:${gatewayPort}`)
    ) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// ── Gateway Restart ───────────────────────────────────────────────
async function restartGateway() {
  updateTrayStatus("Restarting...");
  const winclawCmd = path.join(installDir, "winclaw.cmd");
  try {
    execFile(winclawCmd, ["gateway", "restart"], {
      cwd: installDir,
      windowsHide: true,
    });
  } catch (err) {
    console.error("[gateway] Restart error:", err.message);
  }

  const ready = await waitForGateway(gatewayPort, 15);
  updateTrayStatus(ready ? "Running" : "Failed");
  if (ready && mainWindow) {
    mainWindow.loadURL(buildGatewayUrl());
  }
}

// ── App Lifecycle ─────────────────────────────────────────────────
app.on("second-instance", () => {
  // When a second instance is launched, focus the existing window
  if (mainWindow) {
    mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Don't quit when all windows are closed (tray app behavior)
  // Only quit when explicitly exiting via tray menu
});

app.whenReady().then(async () => {
  // Resolve gateway config
  const config = resolveGatewayConfig();
  gatewayPort = config.port;
  gatewayToken = config.token;

  // Create application menu (i18n, hidden bar — shortcuts only)
  createAppMenu();

  // Setup hamburger menu IPC handler
  setupHamburgerMenu();

  // Create tray icon
  createTray();

  // Create window (hidden initially)
  createMainWindow();

  // Check if gateway is already running
  const alreadyRunning = await checkGatewayHealth(gatewayPort);

  if (alreadyRunning) {
    console.log("[gateway] Already running on port", gatewayPort);
    updateTrayStatus("Connected");
  } else {
    // Start gateway
    console.log("[gateway] Not running, starting...");
    updateTrayStatus("Starting...");
    gatewayProcess = startGateway();

    const ready = await waitForGateway(gatewayPort);
    if (ready) {
      updateTrayStatus("Running");
    } else {
      updateTrayStatus("Failed");
      // Show error dialog
      dialog.showErrorBox(
        "WinClaw Gateway",
        `Gateway failed to start on port ${gatewayPort}.\nPlease check the logs or run 'winclaw gateway' manually.`,
      );
    }
  }

  // Load the gateway UI
  const url = buildGatewayUrl();
  console.log("[window] Loading:", url);
  mainWindow.loadURL(url);

  // Inject hamburger button after page loads
  mainWindow.webContents.on("did-finish-load", () => {
    injectHamburgerButton();
  });

  // Show window once content is loaded
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Fallback: show window after 5 seconds even if page hasn't loaded
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 5000);
});
