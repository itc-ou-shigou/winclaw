using System;
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

        // Global exception handlers to prevent silent crashes
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += OnThreadException;
        AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);

        Application.Run(new MainForm());
    }

    private static void ActivateExistingInstance()
    {
        // Search by fixed window class name — immune to dynamic title changes
        // (e.g. "Dashboard — WinClaw") and works even when the window is hidden.
        var hwnd = NativeMethods.FindWindow(MainForm.WindowClassName, null);
        if (hwnd != IntPtr.Zero)
        {
            // Grant the existing instance permission to steal foreground focus.
            // Without this, Windows blocks SetForegroundWindow from background
            // processes (our ShowAndActivate would silently fail).
            NativeMethods.AllowSetForegroundWindow(NativeMethods.ASFW_ANY);

            // Send WM_SHOWME directly to the found window. This works reliably
            // for hidden windows, unlike HWND_BROADCAST which may not reach them.
            NativeMethods.PostMessage(
                hwnd,
                MainForm.WM_SHOWME,
                IntPtr.Zero,
                IntPtr.Zero);
        }
        // else: Window not found — first instance may have crashed.
        //       The mutex will be released when this process exits, allowing
        //       a clean start next time.
    }

    private static void OnThreadException(object sender, ThreadExceptionEventArgs e)
    {
        Console.Error.WriteLine($"[WinClawUI] Thread exception: {e.Exception}");
    }

    private static void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        Console.Error.WriteLine($"[WinClawUI] Unhandled exception: {e.ExceptionObject}");
    }
}

internal static partial class NativeMethods
{
    public const int SW_SHOW = 5;
    public const int SW_RESTORE = 9;
    public const int ASFW_ANY = -1;
    public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);

    [LibraryImport("user32.dll", EntryPoint = "FindWindowW", StringMarshalling = StringMarshalling.Utf16)]
    public static partial IntPtr FindWindow(string? lpClassName, string? lpWindowName);

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
