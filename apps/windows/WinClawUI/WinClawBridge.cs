using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace WinClawUI;

/// <summary>
/// COM-visible bridge exposed to JavaScript via WebView2's AddHostObjectToScript.
/// Provides native OS dialogs (e.g. folder picker) that the web UI cannot access directly.
/// </summary>
[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public class WinClawBridge
{
    private readonly Form _owner;

    public WinClawBridge(Form owner)
    {
        _owner = owner;
    }

    /// <summary>
    /// Show a native folder browser dialog and return the selected path.
    /// Returns an empty string if the user cancels.
    /// Called from JS: await chrome.webview.hostObjects.winclawBridge.ShowFolderDialog(initialPath)
    /// </summary>
    public string ShowFolderDialog(string initialPath)
    {
        if (_owner.IsDisposed || !_owner.IsHandleCreated)
        {
            Logger.Warn("ShowFolderDialog called on disposed/unready form");
            return "";
        }

        try
        {
            string result = "";
            if (_owner.InvokeRequired)
            {
                _owner.Invoke(() => result = ShowFolderDialogOnUIThread(initialPath));
            }
            else
            {
                result = ShowFolderDialogOnUIThread(initialPath);
            }
            return result;
        }
        catch (ObjectDisposedException)
        {
            Logger.Warn("ShowFolderDialog: form was disposed during invocation");
            return "";
        }
        catch (InvalidOperationException ex)
        {
            Logger.Warn($"ShowFolderDialog: invoke failed: {ex.Message}");
            return "";
        }
    }

    private static string ShowFolderDialogOnUIThread(string initialPath)
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "Select workspace folder",
            UseDescriptionForTitle = true,
            ShowNewFolderButton = true,
        };

        if (!string.IsNullOrEmpty(initialPath) && Directory.Exists(initialPath))
        {
            dialog.InitialDirectory = initialPath;
        }

        return dialog.ShowDialog() == DialogResult.OK ? dialog.SelectedPath : "";
    }
}
