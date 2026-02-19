using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Sockets;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WinClawUI;

public enum GatewayStatus
{
    Stopped,
    Starting,
    Running,
    AttachedExisting,
    Failed,
}

public sealed class GatewayStatusEventArgs : EventArgs
{
    public GatewayStatus Status { get; }
    public string? Details { get; }

    public GatewayStatusEventArgs(GatewayStatus status, string? details = null)
    {
        Status = status;
        Details = details;
    }
}

public static class GatewayStatusExtensions
{
    public static string ToDisplayString(this GatewayStatus status) => status switch
    {
        GatewayStatus.Stopped => "Stopped",
        GatewayStatus.Starting => "Starting...",
        GatewayStatus.Running => "Running",
        GatewayStatus.AttachedExisting => "Connected",
        GatewayStatus.Failed => "Failed",
        _ => "Unknown",
    };
}

/// <summary>
/// Manages the WinClaw Node.js gateway subprocess lifecycle.
/// Mirrors the macOS GatewayProcessManager.swift try-attach-first pattern.
/// </summary>
public sealed class GatewayManager : IDisposable
{
    private const int DefaultPort = 18789;
    private const int HealthCheckMaxRetries = 15;
    private const int HealthCheckInitialDelayMs = 1000;

    private Process? _gatewayProcess;
    private bool _weSpawnedGateway;
    private CancellationTokenSource? _healthCheckCts;
    private GatewayStatus _status = GatewayStatus.Stopped;
    private readonly HttpClient _httpClient;
    private Timer? _watchdogTimer;
    private const int WatchdogIntervalMs = 10_000; // 10 seconds

    public event EventHandler<GatewayStatusEventArgs>? StatusChanged;

    public int Port { get; private set; } = DefaultPort;
    public string? Token { get; private set; }
    public string GatewayUrl => $"http://127.0.0.1:{Port}/";

    /// <summary>
    /// Gateway URL with auth token appended as a hash fragment (#token=xxx).
    /// Falls back to plain GatewayUrl when no token is configured.
    /// </summary>
    public string GatewayUrlWithToken =>
        string.IsNullOrEmpty(Token) ? GatewayUrl : $"{GatewayUrl}#token={Uri.EscapeDataString(Token)}";

    public GatewayStatus Status => _status;

    public GatewayManager()
    {
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        ResolvePort();
        ResolveToken();
    }

    // ──────────────────────────────────────────────────────────────────
    //  Port resolution — mirrors WinClaw src/config/paths.ts resolveGatewayPort
    // ──────────────────────────────────────────────────────────────────

    private void ResolvePort()
    {
        // 1. Environment variable
        var envPort = Environment.GetEnvironmentVariable("WINCLAW_GATEWAY_PORT")
                   ?? Environment.GetEnvironmentVariable("CLAWDBOT_GATEWAY_PORT");
        if (!string.IsNullOrWhiteSpace(envPort) &&
            int.TryParse(envPort.Trim(), out int parsed) && parsed > 0 && parsed <= 65535)
        {
            Port = parsed;
            return;
        }

        // 2. Config file: ~/.winclaw/winclaw.json -> gateway.port (path must match Node.js side)
        try
        {
            var configPath = ResolveConfigPath();
            if (configPath != null && File.Exists(configPath))
            {
                var json = File.ReadAllText(configPath);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("gateway", out var gw) &&
                    gw.TryGetProperty("port", out var portProp) &&
                    portProp.TryGetInt32(out int cfgPort) && cfgPort > 0)
                {
                    Port = cfgPort;
                    return;
                }
            }
        }
        catch (Exception ex)
        {
            Logger.Warn($"Config parse error during port resolution: {ex.Message}");
        }

        Port = DefaultPort;
    }

    /// <summary>
    /// Resolve the gateway auth token from environment variables or config file.
    /// Mirrors the Node.js resolveGatewayAuth logic in src/gateway/auth.ts.
    /// </summary>
    private void ResolveToken()
    {
        // 1. Environment variable (same precedence as Node.js side)
        var envToken = Environment.GetEnvironmentVariable("WINCLAW_GATEWAY_TOKEN")
                    ?? Environment.GetEnvironmentVariable("CLAWDBOT_GATEWAY_TOKEN");
        if (!string.IsNullOrWhiteSpace(envToken))
        {
            Token = envToken.Trim();
            return;
        }

        // 2. Config file: ~/.winclaw/winclaw.json -> gateway.auth.token
        try
        {
            var configPath = ResolveConfigPath();
            if (configPath != null && File.Exists(configPath))
            {
                var json = File.ReadAllText(configPath);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("gateway", out var gw) &&
                    gw.TryGetProperty("auth", out var auth) &&
                    auth.TryGetProperty("token", out var tokenProp) &&
                    tokenProp.ValueKind == JsonValueKind.String)
                {
                    var token = tokenProp.GetString();
                    if (!string.IsNullOrWhiteSpace(token))
                    {
                        Token = token.Trim();
                        return;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Logger.Warn($"Config parse error during token resolution: {ex.Message}");
        }

        Token = null;
    }

    private static string? ResolveConfigPath()
    {
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

        var primary = Path.Combine(home, ".winclaw", "winclaw.json");
        if (File.Exists(primary)) return primary;

        var legacy = Path.Combine(home, ".clawdbot", "clawdbot.json");
        if (File.Exists(legacy)) return legacy;

        return null;
    }

    // ──────────────────────────────────────────────────────────────────
    //  Start — try-attach-first, then spawn
    // ──────────────────────────────────────────────────────────────────

    public async Task StartAsync()
    {
        if (_status is GatewayStatus.Starting or GatewayStatus.Running
            or GatewayStatus.AttachedExisting)
        {
            return; // Already active
        }

        SetStatus(GatewayStatus.Starting);

        // Step 1: Try to attach to an already-running gateway
        if (await TryAttachExistingAsync())
        {
            return;
        }

        // Step 2: Spawn a new gateway process
        await SpawnGatewayAsync();
    }

    // ──────────────────────────────────────────────────────────────────
    //  Attach to existing gateway
    // ──────────────────────────────────────────────────────────────────

    private async Task<bool> TryAttachExistingAsync()
    {
        if (!await IsPortListeningAsync())
        {
            return false;
        }

        // Port is listening — try health check
        for (int attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                var response = await _httpClient.GetAsync(GatewayUrl);
                if (response.IsSuccessStatusCode)
                {
                    SetStatus(GatewayStatus.AttachedExisting, $"port {Port}");
                    return true;
                }
            }
            catch
            {
                if (attempt < 2)
                {
                    await Task.Delay(300);
                    continue;
                }
            }
        }

        // Port occupied but not a healthy gateway
        SetStatus(GatewayStatus.Failed,
            $"Port {Port} in use but not responding as WinClaw gateway");
        return true; // Prevent spawning on an occupied port
    }

    private async Task<bool> IsPortListeningAsync()
    {
        try
        {
            using var tcp = new TcpClient();
            var task = tcp.ConnectAsync("127.0.0.1", Port);
            var completed = await Task.WhenAny(task, Task.Delay(1500));
            return completed == task && tcp.Connected;
        }
        catch
        {
            return false;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Spawn gateway process
    // ──────────────────────────────────────────────────────────────────

    private async Task SpawnGatewayAsync()
    {
        var (nodePath, appPath) = ResolveGatewayPaths();

        if (nodePath == null || appPath == null)
        {
            SetStatus(GatewayStatus.Failed,
                "Cannot find node.exe or gateway entry point");
            return;
        }

        try
        {
            var tokenArg = string.IsNullOrEmpty(Token) ? "" : $" --token \"{Token}\"";
            var psi = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = $"--disable-warning=ExperimentalWarning \"{appPath}\" gateway --port {Port}{tokenArg}",
                WorkingDirectory = Path.GetDirectoryName(appPath),
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };

            // Set WINCLAW_HOME if we can determine the install directory
            var installDir = ResolveInstallDir();
            if (installDir != null)
            {
                psi.Environment["WINCLAW_HOME"] = installDir;
            }

            _gatewayProcess = Process.Start(psi);

            if (_gatewayProcess == null || _gatewayProcess.HasExited)
            {
                SetStatus(GatewayStatus.Failed, "Gateway process failed to start");
                return;
            }

            // Drain stdout/stderr to prevent buffer blocking
            _gatewayProcess.BeginOutputReadLine();
            _gatewayProcess.BeginErrorReadLine();
            _weSpawnedGateway = true;

            // Wait for the gateway to become healthy
            await WaitForHealthyAsync();
        }
        catch (Exception ex)
        {
            SetStatus(GatewayStatus.Failed, ex.Message);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Path resolution — matches installer layout:
    //    {app}\WinClawUI.exe
    //    {app}\node\node.exe
    //    {app}\app\winclaw.mjs (or winclaw.mjs for compat)
    // ──────────────────────────────────────────────────────────────────

    private static (string? nodePath, string? appPath) ResolveGatewayPaths()
    {
        var exeDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);

        // Installer layout
        var nodePath = Path.Combine(exeDir, "node", "node.exe");

        // Try winclaw.mjs first, then winclaw.mjs (legacy npm bin name)
        string? appPath = null;
        foreach (var name in new[] { "winclaw.mjs", "winclaw.mjs" })
        {
            var candidate = Path.Combine(exeDir, "app", name);
            if (File.Exists(candidate))
            {
                appPath = candidate;
                break;
            }
        }

        if (File.Exists(nodePath) && appPath != null)
        {
            return (nodePath, appPath);
        }

        // Development fallback: node from PATH
        var pathNode = FindInPath("node.exe");
        if (pathNode != null && appPath != null)
        {
            return (pathNode, appPath);
        }

        // Dev fallback 2: WINCLAW_HOME env var
        var winclawHome = Environment.GetEnvironmentVariable("WINCLAW_HOME");
        if (!string.IsNullOrEmpty(winclawHome))
        {
            var homeNode = Path.Combine(winclawHome, "node", "node.exe");
            foreach (var name in new[] { "winclaw.mjs", "winclaw.mjs" })
            {
                var candidate = Path.Combine(winclawHome, "app", name);
                if (File.Exists(candidate))
                {
                    var resolvedNode = File.Exists(homeNode) ? homeNode : FindInPath("node.exe");
                    if (resolvedNode != null) return (resolvedNode, candidate);
                }
            }
        }

        return (null, null);
    }

    private static string? FindInPath(string exe)
    {
        var path = Environment.GetEnvironmentVariable("PATH");
        if (path == null) return null;

        foreach (var dir in path.Split(Path.PathSeparator))
        {
            var candidate = Path.Combine(dir.Trim(), exe);
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static string? ResolveInstallDir()
    {
        var exeDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        if (Directory.Exists(Path.Combine(exeDir, "node")))
        {
            return exeDir;
        }
        return Environment.GetEnvironmentVariable("WINCLAW_HOME");
    }

    // ──────────────────────────────────────────────────────────────────
    //  Health check with retries + exponential backoff
    // ──────────────────────────────────────────────────────────────────

    private async Task WaitForHealthyAsync()
    {
        _healthCheckCts = new CancellationTokenSource();
        var ct = _healthCheckCts.Token;
        int delay = HealthCheckInitialDelayMs;

        for (int i = 0; i < HealthCheckMaxRetries; i++)
        {
            if (ct.IsCancellationRequested) return;

            // Check if the process died
            if (_gatewayProcess is { HasExited: true })
            {
                SetStatus(GatewayStatus.Failed,
                    $"Gateway exited with code {_gatewayProcess.ExitCode}");
                return;
            }

            try
            {
                var response = await _httpClient.GetAsync(GatewayUrl, ct);
                if (response.IsSuccessStatusCode)
                {
                    SetStatus(GatewayStatus.Running, $"pid {_gatewayProcess?.Id}");
                    StartWatchdog();
                    return;
                }
            }
            catch when (!ct.IsCancellationRequested)
            {
                // Expected during startup — gateway not listening yet
            }

            try { await Task.Delay(delay, ct); } catch (TaskCanceledException) { return; }

            // Exponential backoff, capped at 3 seconds
            delay = Math.Min(delay * 3 / 2, 3000);
        }

        SetStatus(GatewayStatus.Failed, "Gateway did not become healthy in time");
    }

    // ──────────────────────────────────────────────────────────────────
    //  Restart
    // ──────────────────────────────────────────────────────────────────

    public async Task RestartAsync()
    {
        Stop();
        await Task.Delay(500); // Brief pause for port release
        await StartAsync();
    }

    // ──────────────────────────────────────────────────────────────────
    //  Stop — only kills gateway if we spawned it
    // ──────────────────────────────────────────────────────────────────

    public void Stop()
    {
        StopWatchdog();
        _healthCheckCts?.Cancel();

        if (_weSpawnedGateway && _gatewayProcess != null && !_gatewayProcess.HasExited)
        {
            try
            {
                KillProcessTree(_gatewayProcess.Id);
            }
            catch (Exception ex)
            {
                Logger.Warn($"Failed to kill gateway process tree: {ex.Message}");
            }
        }

        _gatewayProcess?.Dispose();
        _gatewayProcess = null;
        _weSpawnedGateway = false;
        SetStatus(GatewayStatus.Stopped);
    }

    private static void KillProcessTree(int pid)
    {
        try
        {
            // taskkill /T /F /PID kills the entire process tree
            var psi = new ProcessStartInfo
            {
                FileName = "taskkill",
                Arguments = $"/T /F /PID {pid}",
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var proc = Process.Start(psi);
            proc?.WaitForExit(5000);
        }
        catch (Exception ex)
        {
            Logger.Warn($"taskkill failed for pid {pid}: {ex.Message}");
            // Last resort: direct kill
            try { Process.GetProcessById(pid).Kill(true); }
            catch (Exception innerEx) { Logger.Warn($"Direct kill also failed: {innerEx.Message}"); }
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Status
    // ──────────────────────────────────────────────────────────────────

    private void SetStatus(GatewayStatus status, string? details = null)
    {
        _status = status;
        StatusChanged?.Invoke(this, new GatewayStatusEventArgs(status, details));
    }

    // ──────────────────────────────────────────────────────────────────
    //  Dispose
    // ──────────────────────────────────────────────────────────────────

    public void Dispose()
    {
        StopWatchdog();
        Stop();
        _httpClient.Dispose();
        _healthCheckCts?.Dispose();
    }

    // ──────────────────────────────────────────────────────────────────
    //  Watchdog — monitors gateway process health after startup
    // ──────────────────────────────────────────────────────────────────

    private void StartWatchdog()
    {
        if (!_weSpawnedGateway || _gatewayProcess == null)
            return;

        StopWatchdog(); // Ensure no duplicate timers
        Logger.Info($"Starting gateway watchdog (interval={WatchdogIntervalMs}ms)");
        _watchdogTimer = new Timer(WatchdogCallback, null, WatchdogIntervalMs, WatchdogIntervalMs);
    }

    private void StopWatchdog()
    {
        var timer = _watchdogTimer;
        _watchdogTimer = null;
        timer?.Dispose();
    }

    private async void WatchdogCallback(object? state)
    {
        try
        {
            if (_gatewayProcess == null || !_weSpawnedGateway)
            {
                StopWatchdog();
                return;
            }

            if (_gatewayProcess.HasExited)
            {
                Logger.Error($"Gateway process died unexpectedly (exitCode={_gatewayProcess.ExitCode})");
                StopWatchdog();
                SetStatus(GatewayStatus.Failed, $"Gateway process exited with code {_gatewayProcess.ExitCode}");

                // Auto-restart after brief delay
                await Task.Delay(2000);
                Logger.Info("Attempting automatic gateway restart");
                await RestartAsync();
                return;
            }

            // Process is alive — optionally do a lightweight HTTP health check
            try
            {
                var response = await _httpClient.GetAsync(GatewayUrl);
                if (!response.IsSuccessStatusCode)
                {
                    Logger.Warn($"Gateway health check returned {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Logger.Warn($"Gateway health check failed: {ex.Message}");
                // Don't restart — process is alive, might be temporarily busy
            }
        }
        catch (Exception ex)
        {
            Logger.Error("Watchdog callback error", ex);
        }
    }
}
