using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace WinClawUI;

internal static class Program
{
    private const string MutexName = "Global\\WinClawUI_SingleInstance";

    [STAThread]
    static void Main()
    {
        // Single-instance enforcement via named Mutex
        using var mutex = new Mutex(true, MutexName, out bool createdNew);

        if (!createdNew)
        {
            // Another instance is running — activate its window
            ActivateExistingInstance();
            return;
        }

        Logger.Info($"WinClawUI starting (pid={Environment.ProcessId})");

        // Global exception handlers to prevent silent crashes
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += OnThreadException;
        AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;

        // Log process termination regardless of cause
        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            Logger.Info("ProcessExit event fired — process is terminating");
        };
        Application.ApplicationExit += (_, _) =>
        {
            Logger.Info("Application.ApplicationExit event fired");
        };

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);

        Application.Run(new MainForm());
    }

    private static void ActivateExistingInstance()
    {
        // Find other WinClawUI processes (the first instance).
        var currentPid = Environment.ProcessId;
        var targetPids = Process.GetProcessesByName("WinClawUI")
            .Where(p => p.Id != currentPid)
            .Select(p => (uint)p.Id)
            .ToHashSet();

        if (targetPids.Count == 0) return;

        // Grant the existing instance permission to steal foreground focus.
        NativeMethods.AllowSetForegroundWindow(NativeMethods.ASFW_ANY);

        // Enumerate all top-level windows to find ones owned by the other
        // WinClawUI process. EnumWindows reaches hidden windows (tray mode)
        // where MainWindowHandle would be IntPtr.Zero.
        NativeMethods.EnumWindows((hwnd, _) =>
        {
            NativeMethods.GetWindowThreadProcessId(hwnd, out uint pid);
            if (targetPids.Contains(pid))
            {
                NativeMethods.PostMessage(
                    hwnd,
                    MainForm.WM_SHOWME,
                    IntPtr.Zero,
                    IntPtr.Zero);
                return false; // found — stop enumeration
            }
            return true; // continue
        }, IntPtr.Zero);
    }

    private static void OnThreadException(object sender, ThreadExceptionEventArgs e)
    {
        Logger.Error("Unhandled UI thread exception", e.Exception);
        Console.Error.WriteLine($"[WinClawUI] Thread exception: {e.Exception}");
    }

    private static void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is Exception ex)
            Logger.Error("Unhandled domain exception", ex);
        else
            Logger.Error($"Unhandled domain exception: {e.ExceptionObject}");
        Console.Error.WriteLine($"[WinClawUI] Unhandled exception: {e.ExceptionObject}");
    }
}

internal static partial class NativeMethods
{
    public const int ASFW_ANY = -1;

    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [LibraryImport("user32.dll")]
    public static partial uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool SetForegroundWindow(IntPtr hWnd);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool IsIconic(IntPtr hWnd);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool PostMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static partial bool AllowSetForegroundWindow(int dwProcessId);

    [LibraryImport("user32.dll", EntryPoint = "RegisterWindowMessageW", StringMarshalling = StringMarshalling.Utf16)]
    public static partial int RegisterWindowMessage(string message);
}
