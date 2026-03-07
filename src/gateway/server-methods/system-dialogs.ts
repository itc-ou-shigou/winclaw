import { execFile } from "node:child_process";
import type { GatewayRequestHandlers } from "./types.js";

export const systemDialogHandlers: GatewayRequestHandlers = {
  "system.showFolderDialog": async ({ params, respond }) => {
    const initialPath =
      typeof params.initialPath === "string" ? params.initialPath : "";

    // Use PowerShell to show a native Windows folder-browser dialog.
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Select workspace directory'
$dlg.ShowNewFolderButton = $true
if ('${initialPath.replace(/'/g, "''")}') {
  $dlg.SelectedPath = '${initialPath.replace(/'/g, "''")}'
}
$result = $dlg.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dlg.SelectedPath
} else {
  Write-Output ''
}
`.trim();

    try {
      const selected = await new Promise<string>((resolve, reject) => {
        execFile(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", ps],
          { timeout: 60_000 },
          (err, stdout) => {
            if (err) {
              reject(err);
            } else {
              resolve((stdout ?? "").trim());
            }
          },
        );
      });

      respond(true, { path: selected || null });
    } catch (err) {
      respond(true, { path: null, error: (err as Error).message });
    }
  },
};
