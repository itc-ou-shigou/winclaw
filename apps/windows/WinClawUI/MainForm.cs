using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace WinClawUI;

public sealed class MainForm : Form
{
    public const string WindowTitle = "WinClaw";

    /// <summary>Custom window message for single-instance activation.</summary>
    public static readonly int WM_SHOWME =
        NativeMethods.RegisterWindowMessage("WinClawUI_WM_SHOWME");

    private readonly WebView2 _webView;
    private readonly NotifyIcon _trayIcon;
    private readonly ContextMenuStrip _trayMenu;
    private readonly ToolStripMenuItem _statusMenuItem;
    private readonly GatewayManager _gateway;
    private bool _isExiting;
    private bool _webViewReady;
    private int _navigationRetryCount;
    private const int MaxNavigationRetries = 10;
    private System.Threading.Timer? _heartbeatTimer;

    public MainForm()
    {
        // ── Window ───────────────────────────────────────────────────
        Text = WindowTitle;
        Size = new Size(1100, 750);
        MinimumSize = new Size(600, 400);
        StartPosition = FormStartPosition.CenterScreen;
        Icon = LoadAppIcon();

        // ── WebView2 ─────────────────────────────────────────────────
        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
        };
        Controls.Add(_webView);

        // ── System Tray ──────────────────────────────────────────────
        _trayMenu = new ContextMenuStrip();

        var showItem = new ToolStripMenuItem("Show WinClaw")
        {
            Font = new Font(SystemFonts.MenuFont!, FontStyle.Bold),
        };
        showItem.Click += (_, _) => ShowAndActivate();

        _statusMenuItem = new ToolStripMenuItem("Gateway: Starting...")
        {
            Enabled = false,
        };

        var restartItem = new ToolStripMenuItem("Restart Gateway");
        restartItem.Click += async (_, _) => await RestartGatewayAsync();

        var exitItem = new ToolStripMenuItem("Exit");
        exitItem.Click += (_, _) => ExitApplication();

        _trayMenu.Items.Add(showItem);
        _trayMenu.Items.Add(new ToolStripSeparator());
        _trayMenu.Items.Add(_statusMenuItem);
        _trayMenu.Items.Add(restartItem);
        _trayMenu.Items.Add(new ToolStripSeparator());
        _trayMenu.Items.Add(exitItem);

        _trayIcon = new NotifyIcon
        {
            Icon = LoadAppIcon(),
            Text = "WinClaw",
            Visible = true,
            ContextMenuStrip = _trayMenu,
        };
        _trayIcon.MouseClick += TrayIcon_MouseClick;

        // ── Gateway Manager ──────────────────────────────────────────
        _gateway = new GatewayManager();
        _gateway.StatusChanged += OnGatewayStatusChanged;

        // ── Form events ──────────────────────────────────────────────
        Load += MainForm_Load;
        FormClosing += MainForm_FormClosing;
        Resize += MainForm_Resize;
    }

    // ═════════════════════════════════════════════════════════════════
    //  Initialization
    // ═════════════════════════════════════════════════════════════════

    private async void MainForm_Load(object? sender, EventArgs e)
    {
        // Start gateway first (needed for both WebView2 and browser fallback)
        _ = _gateway.StartAsync();

        // Start heartbeat timer — logs uptime, memory, gateway status every 5 minutes
        _heartbeatTimer = new System.Threading.Timer(HeartbeatCallback, null, 300_000, 300_000);

        // Check WebView2 availability — seamless browser fallback if missing
        if (!IsWebView2Available())
        {
            // Open in default browser silently (no dialog)
            await WaitForGatewayAndOpenBrowser();

            // Try to install WebView2 in background for next launch
            _ = Task.Run(() => TryInstallWebView2InBackground());

            // Keep running as tray app (gateway manager + tray icon remain active)
            _webView.Visible = false;
            return;
        }

        // Initialize WebView2
        try
        {
            var userDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "WinClaw", "WebView2");

            var env = await CoreWebView2Environment.CreateAsync(
                userDataFolder: userDataDir);

            await _webView.EnsureCoreWebView2Async(env);
            _webViewReady = true;

            // Expose native OS dialogs to the web UI via JS interop
            _webView.CoreWebView2.AddHostObjectToScript(
                "winclawBridge", new WinClawBridge(this));

            // Configure WebView2 settings
            var settings = _webView.CoreWebView2.Settings;
            settings.IsStatusBarEnabled = false;
            settings.AreDefaultContextMenusEnabled = true;
            settings.IsZoomControlEnabled = true;
            settings.AreDevToolsEnabled = true; // Allow F12 for debugging

            // Update window title from page title
            _webView.CoreWebView2.DocumentTitleChanged += (_, _) =>
            {
                var pageTitle = _webView.CoreWebView2.DocumentTitle;
                Text = string.IsNullOrEmpty(pageTitle) ? WindowTitle : $"{pageTitle} — WinClaw";
            };

            // Handle navigation failures
            _webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;

            // Handle WebView2 renderer/browser process crashes
            _webView.CoreWebView2.ProcessFailed += OnWebView2ProcessFailed;

            // Open external links in system browser
            _webView.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                OpenUrl(args.Uri);
            };

            // Navigate to gateway (may not be ready yet — will retry)
            NavigateToGateway();
        }
        catch (Exception ex)
        {
            Logger.Error("WebView2 initialization failed, falling back to browser", ex);
            await WaitForGatewayAndOpenBrowser();
            _webView.Visible = false;
        }
    }

    private static bool IsWebView2Available()
    {
        try
        {
            var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            return !string.IsNullOrEmpty(version);
        }
        catch (Exception ex)
        {
            Logger.Warn($"WebView2 availability check failed: {ex.Message}");
            return false;
        }
    }

    // ═════════════════════════════════════════════════════════════════
    //  Navigation & Retry
    // ═════════════════════════════════════════════════════════════════

    private void NavigateToGateway()
    {
        if (_webViewReady && _webView.CoreWebView2 != null)
        {
            _webView.CoreWebView2.Navigate(_gateway.GatewayUrlWithToken);
        }
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        if (args.IsSuccess)
        {
            _navigationRetryCount = 0;
            return;
        }

        if (_isExiting || _gateway.Status == GatewayStatus.Failed)
            return;

        _navigationRetryCount++;
        Logger.Warn($"Navigation failed (attempt {_navigationRetryCount}/{MaxNavigationRetries}): status={args.WebErrorStatus}");

        if (_navigationRetryCount >= MaxNavigationRetries)
        {
            FallbackToBrowser("navigation failed after max retries");
            return;
        }

        _ = RetryNavigationAsync();
    }

    private async Task RetryNavigationAsync()
    {
        await Task.Delay(1500);
        if (!_isExiting && _webViewReady)
        {
            NavigateToGateway();
        }
    }

    // ═════════════════════════════════════════════════════════════════
    //  WebView2 Process Crash Recovery
    // ═════════════════════════════════════════════════════════════════

    private async void OnWebView2ProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs args)
    {
        Logger.Error($"WebView2 process failed: kind={args.ProcessFailedKind}, reason={args.Reason}, exitCode={args.ExitCode}");

        switch (args.ProcessFailedKind)
        {
            case CoreWebView2ProcessFailedKind.BrowserProcessExited:
                // The browser process itself exited — WebView2 cannot recover.
                FallbackToBrowser("browser process exited");
                break;

            case CoreWebView2ProcessFailedKind.RenderProcessExited:
            case CoreWebView2ProcessFailedKind.RenderProcessUnresponsive:
                // Renderer crash — attempt reload after a brief delay.
                Logger.Info("Attempting WebView2 reload after renderer failure");
                await Task.Delay(500);
                if (!_isExiting && _webViewReady && _webView?.CoreWebView2 != null)
                {
                    try
                    {
                        _webView.CoreWebView2.Reload();
                    }
                    catch (Exception ex)
                    {
                        Logger.Error("WebView2 reload failed, falling back to browser", ex);
                        FallbackToBrowser("reload failed after renderer crash");
                    }
                }
                break;

            default:
                // Other sub-process failures (GPU, utility, etc.) — try reload.
                Logger.Warn($"WebView2 sub-process failed ({args.ProcessFailedKind}), attempting reload");
                await Task.Delay(500);
                if (!_isExiting && _webViewReady && _webView?.CoreWebView2 != null)
                {
                    try
                    {
                        _webView.CoreWebView2.Reload();
                    }
                    catch (Exception ex)
                    {
                        Logger.Warn($"Reload after sub-process failure failed: {ex.Message}");
                    }
                }
                break;
        }
    }

    private void FallbackToBrowser(string reason)
    {
        Logger.Warn($"Falling back to system browser: {reason}");
        _webViewReady = false;
        _webView.Visible = false;
        OpenUrl(_gateway.GatewayUrlWithToken);
    }

    // ═════════════════════════════════════════════════════════════════
    //  Heartbeat — periodic liveness & resource logging
    // ═════════════════════════════════════════════════════════════════

    private void HeartbeatCallback(object? state)
    {
        try
        {
            using var proc = Process.GetCurrentProcess();
            var memMb = proc.WorkingSet64 / (1024 * 1024);
            var uptime = DateTime.Now - proc.StartTime;
            Logger.Info($"Heartbeat: uptime={uptime:hh\\:mm\\:ss}, mem={memMb}MB, gateway={_gateway.Status}, webViewReady={_webViewReady}");

            if (memMb > 500)
            {
                Logger.Warn($"High memory usage: {memMb} MB");
            }
        }
        catch
        {
            // Heartbeat must never crash the app
        }
    }

    // ═════════════════════════════════════════════════════════════════
    //  Close-to-Tray
    // ═════════════════════════════════════════════════════════════════

    private void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
    {
        Logger.Info($"FormClosing fired: reason={e.CloseReason}, isExiting={_isExiting}");

        if (!_isExiting)
        {
            switch (e.CloseReason)
            {
                case CloseReason.UserClosing:
                case CloseReason.None:           // Win32 WM_CLOSE from external source
                case CloseReason.FormOwnerClosing:
                    // Minimize to tray instead of closing
                    e.Cancel = true;
                    Hide();
                    return;

                case CloseReason.WindowsShutDown:
                    Logger.Info("Windows shutdown detected, exiting gracefully");
                    break;

                case CloseReason.TaskManagerClosing:
                    Logger.Info("Task manager close detected");
                    break;

                case CloseReason.ApplicationExitCall:
                    Logger.Info("Application.Exit() called from external source");
                    break;

                default:
                    Logger.Warn($"Unexpected close reason: {e.CloseReason}");
                    break;
            }
        }

        // Real exit — cleanup
        _trayIcon.Visible = false;
        _trayIcon.Dispose();
        _gateway.Dispose();
    }

    private void MainForm_Resize(object? sender, EventArgs e)
    {
        if (WindowState == FormWindowState.Minimized)
        {
            Hide(); // Minimize to tray instead of taskbar
        }
    }

    // ═════════════════════════════════════════════════════════════════
    //  System Tray
    // ═════════════════════════════════════════════════════════════════

    private void TrayIcon_MouseClick(object? sender, MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Left)
        {
            if (Visible && WindowState != FormWindowState.Minimized)
            {
                Hide();
            }
            else
            {
                ShowAndActivate();
            }
        }
        // Right-click: ContextMenuStrip handles this automatically
    }

    private void ShowAndActivate()
    {
        if (!_webViewReady)
        {
            // Browser fallback mode — open in browser instead
            OpenUrl(_gateway.GatewayUrlWithToken);
            return;
        }
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
        BringToFront();
    }

    private void ExitApplication()
    {
        _isExiting = true;
        _trayIcon.Visible = false;
        Application.Exit();
    }

    private async Task RestartGatewayAsync()
    {
        await _gateway.RestartAsync();
        // After restart, re-navigate
        NavigateToGateway();
    }

    // ═════════════════════════════════════════════════════════════════
    //  Gateway Status Updates
    // ═════════════════════════════════════════════════════════════════

    private void OnGatewayStatusChanged(object? sender, GatewayStatusEventArgs e)
    {
        if (InvokeRequired)
        {
            try { Invoke(() => OnGatewayStatusChanged(sender, e)); }
            catch (ObjectDisposedException) { /* Form disposed during shutdown */ }
            catch (InvalidOperationException) { /* Handle not yet created or already destroyed */ }
            return;
        }

        // Update tray menu status line
        _statusMenuItem.Text = $"Gateway: {e.Status.ToDisplayString()}";

        // Update tray tooltip
        var tooltip = $"WinClaw — {e.Status.ToDisplayString()}";
        if (tooltip.Length > 63) tooltip = tooltip[..63]; // NotifyIcon.Text max 63 chars
        _trayIcon.Text = tooltip;

        // When gateway becomes healthy, navigate if WebView2 is at blank page
        if (e.Status is GatewayStatus.Running or GatewayStatus.AttachedExisting)
        {
            if (_webViewReady && _webView.CoreWebView2 != null)
            {
                var src = _webView.CoreWebView2.Source;
                if (string.IsNullOrEmpty(src) || src == "about:blank" ||
                    src.StartsWith("edge:"))
                {
                    NavigateToGateway();
                }
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════
    //  Single-Instance: handle WM_SHOWME message from second instance
    // ═════════════════════════════════════════════════════════════════

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_SHOWME)
        {
            ShowAndActivate();
        }
        base.WndProc(ref m);
    }

    // ═════════════════════════════════════════════════════════════════
    //  Helpers
    // ═════════════════════════════════════════════════════════════════

    private static Icon LoadAppIcon()
    {
        var exeDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);

        // Try installer layout: {app}\assets\winclaw.ico
        var assetPath = Path.Combine(exeDir, "assets", "winclaw.ico");
        if (File.Exists(assetPath))
        {
            return new Icon(assetPath);
        }

        // Try development: project Resources
        var devPath = Path.Combine(exeDir, "Resources", "winclaw.ico");
        if (File.Exists(devPath))
        {
            return new Icon(devPath);
        }

        return SystemIcons.Application;
    }

    /// <summary>Wait until gateway is healthy, then open the UI in the default browser.</summary>
    private async Task WaitForGatewayAndOpenBrowser()
    {
        // Wait up to 30 seconds for gateway to become ready
        for (var i = 0; i < 60; i++)
        {
            if (_gateway.Status is GatewayStatus.Running or GatewayStatus.AttachedExisting)
            {
                OpenUrl(_gateway.GatewayUrlWithToken);
                return;
            }
            if (_gateway.Status is GatewayStatus.Failed)
                break;
            await Task.Delay(500);
        }
        // Last resort — open anyway (the page will auto-retry)
        OpenUrl(_gateway.GatewayUrlWithToken);
    }

    /// <summary>
    /// Try to silently install WebView2 Evergreen Runtime in background.
    /// On next WinClawUI launch, the desktop app experience will be available.
    /// </summary>
    private static void TryInstallWebView2InBackground()
    {
        try
        {
            // Look for the bootstrapper next to the exe (installer copies it)
            var exeDir = AppContext.BaseDirectory.TrimEnd(System.IO.Path.DirectorySeparatorChar);
            var bootstrapper = System.IO.Path.Combine(exeDir, "MicrosoftEdgeWebview2Setup.exe");
            if (!System.IO.File.Exists(bootstrapper))
            {
                // Also check parent dir (installer layout: {app}\MicrosoftEdgeWebview2Setup.exe)
                var parentDir = System.IO.Path.GetDirectoryName(exeDir);
                if (parentDir != null)
                    bootstrapper = System.IO.Path.Combine(parentDir, "MicrosoftEdgeWebview2Setup.exe");
            }
            if (!System.IO.File.Exists(bootstrapper))
                return; // No bootstrapper available — skip

            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = bootstrapper,
                Arguments = "/silent /install",
                UseShellExecute = true,
                CreateNoWindow = true,
                WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
            };
            var proc = System.Diagnostics.Process.Start(psi);
            proc?.WaitForExit(120_000); // Wait up to 2 minutes
        }
        catch (Exception ex)
        {
            Logger.Warn($"WebView2 background install failed: {ex.Message}");
        }
    }

    private static void OpenUrl(string url)
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true,
            };
            System.Diagnostics.Process.Start(psi);
        }
        catch (Exception ex)
        {
            Logger.Error($"Failed to open URL in browser: {ex.Message}");
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            Logger.Info("MainForm disposing");
            _heartbeatTimer?.Dispose();
            _heartbeatTimer = null;
            if (_webViewReady && _webView?.CoreWebView2 != null)
            {
                _webView.CoreWebView2.NavigationCompleted -= OnNavigationCompleted;
                _webView.CoreWebView2.ProcessFailed -= OnWebView2ProcessFailed;
            }
            _gateway.StatusChanged -= OnGatewayStatusChanged;
            _webView?.Dispose();
            _trayIcon?.Dispose();
            _trayMenu?.Dispose();
            _gateway?.Dispose();
        }
        base.Dispose(disposing);
    }
}
