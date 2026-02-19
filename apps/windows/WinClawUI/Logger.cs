using System;
using System.IO;

namespace WinClawUI;

/// <summary>
/// Simple file-based logger for WinClawUI diagnostics.
/// Writes to %LOCALAPPDATA%\WinClaw\logs\winclaw-ui.log
/// Thread-safe with log rotation at 5 MB.
/// </summary>
internal static class Logger
{
    private const long MaxLogBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly object _lock = new();
    private static string? _logPath;
    private static bool _initFailed;

    public static void Info(string message) => Write("INFO", message);
    public static void Warn(string message) => Write("WARN", message);

    public static void Error(string message) => Write("ERROR", message);

    public static void Error(string message, Exception ex) =>
        Write("ERROR", $"{message}: {ex}");

    private static void Write(string level, string message)
    {
        lock (_lock)
        {
            try
            {
                if (_initFailed) return;

                if (_logPath == null)
                {
                    var dir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "WinClaw", "logs");
                    Directory.CreateDirectory(dir);
                    _logPath = Path.Combine(dir, "winclaw-ui.log");
                }

                // Rotate if exceeding max size
                try
                {
                    var fi = new FileInfo(_logPath);
                    if (fi.Exists && fi.Length > MaxLogBytes)
                    {
                        var rotated = _logPath + ".1";
                        if (File.Exists(rotated))
                            File.Delete(rotated);
                        File.Move(_logPath, rotated);
                    }
                }
                catch
                {
                    // Rotation failed — continue writing to current file
                }

                var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
                var line = $"[{timestamp}] [{level}] {message}{Environment.NewLine}";
                File.AppendAllText(_logPath, line);
            }
            catch
            {
                // Logging must never crash the application.
                // If we can't write, silently degrade.
                _initFailed = true;
            }
        }
    }
}
