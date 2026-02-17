; WinClaw Windows Installer - Inno Setup Script
; Mirrors macOS package-mac-app.sh for Windows platform

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef StagingDir
  #define StagingDir "..\dist\win-staging"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

[Setup]
AppName=WinClaw
AppVersion={#AppVersion}
AppVerName=WinClaw {#AppVersion}
AppPublisher=WinClaw
AppPublisherURL=https://winclaw.ai
AppSupportURL=https://winclaw.ai/docs
DefaultDirName={autopf}\WinClaw
DefaultGroupName=WinClaw
OutputDir={#OutputDir}
OutputBaseFilename=WinClawSetup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ChangesEnvironment=yes
UninstallDisplayIcon={app}\assets\winclaw.ico
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17134

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "chinesetraditional"; MessagesFile: "compiler:Languages\ChineseTraditional.isl"

[Files]
; Node.js runtime
Source: "{#StagingDir}\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs
; WinClaw app
Source: "{#StagingDir}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs
; Desktop app (WinClawUI.exe — native WebView2 shell, optional)
Source: "{#StagingDir}\WinClawUI.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; Launchers (winclaw-ui.cmd kept as browser fallback)
Source: "{#StagingDir}\winclaw.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\winclaw-ui.cmd"; DestDir: "{app}"; Flags: ignoreversion
; WebView2 Evergreen Bootstrapper (~1.7MB, installs runtime if missing)
; Copy to {tmp} for installer-time install, and to {app} for background install by WinClawUI
Source: "{#StagingDir}\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall skipifsourcedoesntexist
Source: "{#StagingDir}\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; Assets
Source: "{#StagingDir}\assets\winclaw.ico"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "{#StagingDir}\assets\logo.png"; DestDir: "{app}\assets"; Flags: ignoreversion
; VNC Desktop Control components (optional — staged by full installer build)
Source: "{#StagingDir}\vnc\tightvnc-setup.msi"; DestDir: "{app}\vnc"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#StagingDir}\vnc\novnc\*"; DestDir: "{app}\vnc\novnc"; Flags: ignoreversion recursesubdirs skipifsourcedoesntexist
Source: "{#StagingDir}\vnc\setup-vnc-desktop.ps1"; DestDir: "{app}\vnc"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#StagingDir}\vnc\start-vnc-desktop.ps1"; DestDir: "{app}\vnc"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#StagingDir}\vnc\stop-vnc-desktop.ps1"; DestDir: "{app}\vnc"; Flags: ignoreversion skipifsourcedoesntexist
; Chrome DevTools MCP launcher scripts
Source: "{#StagingDir}\scripts\launch-chrome-devtools-mcp.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#StagingDir}\scripts\ensure-chrome-debug.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
; Start Menu — desktop app (preferred) or browser fallback
Name: "{group}\WinClaw"; Filename: "{app}\WinClawUI.exe"; \
  WorkingDir: "{app}"; IconFilename: "{app}\assets\winclaw.ico"; \
  Comment: "Open WinClaw"; Check: FileExists(ExpandConstant('{app}\WinClawUI.exe'))
Name: "{group}\WinClaw"; Filename: "{app}\winclaw-ui.cmd"; \
  WorkingDir: "{app}"; IconFilename: "{app}\assets\winclaw.ico"; \
  Comment: "Open WinClaw Control UI"; Check: not FileExists(ExpandConstant('{app}\WinClawUI.exe'))
Name: "{group}\WinClaw (Browser)"; Filename: "{app}\winclaw-ui.cmd"; \
  WorkingDir: "{app}"; IconFilename: "{app}\assets\winclaw.ico"; \
  Comment: "Open WinClaw in browser"; Check: FileExists(ExpandConstant('{app}\WinClawUI.exe'))
Name: "{group}\WinClaw Gateway"; Filename: "{app}\winclaw.cmd"; Parameters: "gateway"; \
  WorkingDir: "{app}"; Comment: "Start WinClaw Gateway"
Name: "{group}\WinClaw Onboard"; Filename: "{app}\winclaw.cmd"; Parameters: "onboard"; \
  WorkingDir: "{app}"; Comment: "WinClaw Setup Wizard"
Name: "{group}\WinClaw TUI"; Filename: "{app}\winclaw.cmd"; Parameters: "tui"; \
  WorkingDir: "{app}"; Comment: "WinClaw Terminal UI"
Name: "{group}\VNC Desktop - Start"; Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\vnc\start-vnc-desktop.ps1"""; \
  WorkingDir: "{app}\vnc"; Comment: "Start VNC desktop streaming"
Name: "{group}\VNC Desktop - Stop"; Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\vnc\stop-vnc-desktop.ps1"""; \
  WorkingDir: "{app}\vnc"; Comment: "Stop VNC desktop streaming"
Name: "{group}\Uninstall WinClaw"; Filename: "{uninstallexe}"
; Desktop shortcut — desktop app (preferred) or browser fallback
Name: "{autodesktop}\WinClaw"; Filename: "{app}\WinClawUI.exe"; \
  WorkingDir: "{app}"; IconFilename: "{app}\assets\winclaw.ico"; \
  Comment: "WinClaw - Personal AI Assistant"; Tasks: desktopicon; \
  Check: FileExists(ExpandConstant('{app}\WinClawUI.exe'))
Name: "{autodesktop}\WinClaw"; Filename: "{app}\winclaw-ui.cmd"; \
  WorkingDir: "{app}"; IconFilename: "{app}\assets\winclaw.ico"; \
  Comment: "WinClaw - Personal AI Assistant"; Tasks: desktopicon; \
  Check: not FileExists(ExpandConstant('{app}\WinClawUI.exe'))

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional options:"
Name: "addtopath"; Description: "Add WinClaw to system PATH"; GroupDescription: "Additional options:"; \
  Flags: checkedonce
Name: "vncsetup"; Description: "Install VNC Desktop Control (enables AI desktop automation)"; \
  GroupDescription: "VNC Desktop Control:"; Flags: checkedonce

[Registry]
; Add to PATH (user-level, non-admin safe)
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; \
  ValueData: "{olddata};{app}"; Tasks: addtopath; Check: NeedsAddPath(ExpandConstant('{app}'))

[Run]
; Step 1: Install WebView2 runtime if not already present (silent, no restart)
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; \
  StatusMsg: "Installing WebView2 runtime..."; \
  Flags: runhidden waituntilterminated; Check: not IsWebView2Installed
; Step 2: Launch WinClaw desktop app after install (checked by default)
Filename: "{app}\WinClawUI.exe"; \
  Description: "Launch WinClaw"; \
  Flags: postinstall nowait skipifsilent; Check: FileExists(ExpandConstant('{app}\WinClawUI.exe'))
; Step 2b (fallback): Open in browser if no desktop app
Filename: "{app}\winclaw-ui.cmd"; \
  Description: "Open WinClaw in browser"; \
  Flags: postinstall nowait skipifsilent; Check: not FileExists(ExpandConstant('{app}\WinClawUI.exe'))
; Step 2c: Run interactive onboarding wizard (visible console for user input)
Filename: "{app}\winclaw.cmd"; Parameters: "onboard --flow quickstart"; \
  StatusMsg: "Starting WinClaw setup wizard..."; \
  Description: "Run WinClaw Setup Wizard (recommended)"; \
  Flags: postinstall waituntilterminated skipifsilent unchecked
; Step 3: Install daemon for auto-start on Windows reboot
Filename: "{app}\winclaw.cmd"; Parameters: "daemon install"; \
  StatusMsg: "Installing Gateway daemon..."; \
  Flags: runhidden waituntilterminated
; Step 4: Restart gateway to pick up new version
Filename: "{app}\winclaw.cmd"; Parameters: "gateway restart"; \
  StatusMsg: "Restarting WinClaw Gateway..."; \
  Flags: runhidden waituntilterminated
; Step 5: VNC Desktop Control setup (auto-runs when vncsetup task selected)
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\vnc\setup-vnc-desktop.ps1"""; \
  StatusMsg: "Setting up VNC Desktop Control..."; \
  Flags: runhidden waituntilterminated shellexec; \
  Tasks: vncsetup; Verb: runas

[UninstallRun]
; Pre-uninstall: stop and remove daemon
Filename: "{app}\winclaw.cmd"; Parameters: "daemon uninstall"; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveDaemon"

[Code]
// Check if WebView2 Evergreen Runtime is already installed
function IsWebView2Installed: boolean;
var
  Version: string;
begin
  Result := RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version)
         or RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version)
         or RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version);
end;

// Check if {app} is already in PATH to avoid duplicates
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath) then
  begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Uppercase(Param) + ';', ';' + Uppercase(OrigPath) + ';') = 0;
end;

// Migrate .openclaw -> .winclaw config on post-install
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  UserHome, OldStateDir, NewStateDir, OldConfig, NewConfig: string;
begin
  if CurStep = ssPostInstall then
  begin
    // Remove stale WINCLAW_HOME pointing to install dir (legacy bug)
    Exec(ExpandConstant('{sys}\cmd.exe'),
      '/c "reg delete HKCU\Environment /v WINCLAW_HOME /f >nul 2>&1"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Determine user home directory
    UserHome := GetEnv('USERPROFILE');
    if UserHome = '' then
      UserHome := GetEnv('HOME');
    if UserHome = '' then
      exit;

    OldStateDir := UserHome + '\.openclaw';
    NewStateDir := UserHome + '\.winclaw';
    OldConfig := OldStateDir + '\openclaw.json';
    NewConfig := NewStateDir + '\winclaw.json';

    // Step 1: If .winclaw does not exist but .openclaw does, copy the whole dir
    if not DirExists(NewStateDir) and DirExists(OldStateDir) then
    begin
      Exec(ExpandConstant('{sys}\cmd.exe'),
        '/c xcopy "' + OldStateDir + '" "' + NewStateDir + '" /E /I /H /Y >nul 2>&1',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    // Step 2: If .winclaw exists but winclaw.json is missing, copy from openclaw.json
    if DirExists(NewStateDir) and not FileExists(NewConfig) then
    begin
      if FileExists(NewStateDir + '\openclaw.json') then
      begin
        CopyFile(NewStateDir + '\openclaw.json', NewConfig, False);
      end
      else if FileExists(OldConfig) then
      begin
        CopyFile(OldConfig, NewConfig, False);
      end;
    end;

    // Step 3: If .winclaw exists but key subdirs are missing, copy them from .openclaw
    if DirExists(NewStateDir) and DirExists(OldStateDir) then
    begin
      if not DirExists(NewStateDir + '\credentials') and DirExists(OldStateDir + '\credentials') then
        Exec(ExpandConstant('{sys}\cmd.exe'),
          '/c xcopy "' + OldStateDir + '\credentials" "' + NewStateDir + '\credentials" /E /I /H /Y >nul 2>&1',
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      if not DirExists(NewStateDir + '\identity') and DirExists(OldStateDir + '\identity') then
        Exec(ExpandConstant('{sys}\cmd.exe'),
          '/c xcopy "' + OldStateDir + '\identity" "' + NewStateDir + '\identity" /E /I /H /Y >nul 2>&1',
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      if not DirExists(NewStateDir + '\agents') and DirExists(OldStateDir + '\agents') then
        Exec(ExpandConstant('{sys}\cmd.exe'),
          '/c xcopy "' + OldStateDir + '\agents" "' + NewStateDir + '\agents" /E /I /H /Y >nul 2>&1',
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      if not DirExists(NewStateDir + '\devices') and DirExists(OldStateDir + '\devices') then
        Exec(ExpandConstant('{sys}\cmd.exe'),
          '/c xcopy "' + OldStateDir + '\devices" "' + NewStateDir + '\devices" /E /I /H /Y >nul 2>&1',
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    // Notify explorer of environment changes
    Exec(ExpandConstant('{sys}\cmd.exe'),
      '/c "setx WINCLAW_MIGRATED 1 >nul 2>&1"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

// Cleanup PATH on uninstall
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  OrigPath, AppDir: string;
  P: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    AppDir := ExpandConstant('{app}');
    if RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath) then
    begin
      P := Pos(';' + Uppercase(AppDir), Uppercase(OrigPath));
      if P > 0 then
      begin
        Delete(OrigPath, P, Length(AppDir) + 1);
        RegWriteStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath);
      end;
    end;
  end;
end;
