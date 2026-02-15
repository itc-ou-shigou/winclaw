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
        var hwnd = NativeMethods.FindWindow(null, MainForm.WindowTitle);
        if (hwnd != IntPtr.Zero)
        {
            // If window is minimized, restore it first
            if (NativeMethods.IsIconic(hwnd))
            {
                NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE);
            }
            else
            {
                NativeMethods.ShowWindow(hwnd, NativeMethods.SW_SHOW);
            }
            NativeMethods.SetForegroundWindow(hwnd);
        }
        else
        {
            // Window may be hidden (minimized to tray). Send a custom message
            // to the running instance to show itself. Use WM_USER broadcast.
            NativeMethods.PostMessage(
                NativeMethods.HWND_BROADCAST,
                MainForm.WM_SHOWME,
                IntPtr.Zero,
                IntPtr.Zero);
        }
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
    public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);

    [LibraryImport("user32.dll", EntryPoint = "FindWindowW", StringMarshalling = StringMarshalling.Utf16)]
    public static partial IntPtr FindWindow(string? lpClassName, string lpWindowName);

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

    [LibraryImport("user32.dll", EntryPoint = "RegisterWindowMessageW", StringMarshalling = StringMarshalling.Utf16)]
    public static partial int RegisterWindowMessage(string message);
}
