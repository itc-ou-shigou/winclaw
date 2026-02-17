using System;
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

    /// <summary>
    /// Fixed window class name for FindWindow. The default WinForms class name
    /// is auto-generated and unreliable for cross-process lookup. Using a fixed
    /// name lets the second instance find this window even when the title has
    /// changed (e.g. "Dashboard — WinClaw") or the window is hidden (tray).
    /// </summary>
    public const string WindowClassName = "WinClawUI_MainWindow";

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

            // Open external links in system browser
            _webView.CoreWebView2.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                OpenUrl(args.Uri);
            };

            // Navigate to gateway (may not be ready yet — will retry)
            NavigateToGateway();
        }
        catch
        {
            // WebView2 init failed — seamless browser fallback
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
        catch
        {
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
        if (!args.IsSuccess && !_isExiting &&
            _gateway.Status != GatewayStatus.Failed)
        {
            _ = RetryNavigationAsync();
        }
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
    //  Close-to-Tray
    // ═════════════════════════════════════════════════════════════════

    private void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
    {
        if (!_isExiting && e.CloseReason == CloseReason.UserClosing)
        {
            // Minimize to tray instead of closing
            e.Cancel = true;
            Hide();
            return;
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
            try { Invoke(() => OnGatewayStatusChanged(sender, e)); } catch { }
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
    //  Fixed Window Class Name (for single-instance FindWindow lookup)
    // ═════════════════════════════════════════════════════════════════

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ClassName = WindowClassName;
            return cp;
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
        catch
        {
            // Silently ignore — browser fallback is already working
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
        catch
        {
            // Ignore if browser can't be opened
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _webView?.Dispose();
            _trayIcon?.Dispose();
            _trayMenu?.Dispose();
            _gateway?.Dispose();
        }
        base.Dispose(disposing);
    }
}
