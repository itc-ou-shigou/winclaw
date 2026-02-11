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
; Launchers
Source: "{#StagingDir}\winclaw.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\winclaw-ui.cmd"; DestDir: "{app}"; Flags: ignoreversion
; Assets
Source: "{#StagingDir}\assets\winclaw.ico"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "{#StagingDir}\assets\logo.png"; DestDir: "{app}\assets"; Flags: ignoreversion

[Icons]
; Start Menu
Name: "{group}\WinClaw"; Filename: "{app}\winclaw-ui.cmd"; \
  WorkingDir: "{app}"; IconFilename: "{app}\assets\winclaw.ico"; \
  Comment: "Open WinClaw Control UI"
Name: "{group}\WinClaw Gateway"; Filename: "{app}\winclaw.cmd"; Parameters: "gateway"; \
  WorkingDir: "{app}"; Comment: "Start WinClaw Gateway"
Name: "{group}\WinClaw Onboard"; Filename: "{app}\winclaw.cmd"; Parameters: "onboard"; \
  WorkingDir: "{app}"; Comment: "WinClaw Setup Wizard"
Name: "{group}\WinClaw TUI"; Filename: "{app}\winclaw.cmd"; Parameters: "tui"; \
  WorkingDir: "{app}"; Comment: "WinClaw Terminal UI"
Name: "{group}\Uninstall WinClaw"; Filename: "{uninstallexe}"
; Desktop (optional) - launches Web UI (starts gateway + opens browser)
Name: "{autodesktop}\WinClaw"; Filename: "{app}\winclaw-ui.cmd"; \
  WorkingDir: "{app}"; IconFilename: "{app}\assets\winclaw.ico"; \
  Comment: "WinClaw - Personal AI Assistant"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional options:"
Name: "addtopath"; Description: "Add WinClaw to system PATH"; GroupDescription: "Additional options:"; \
  Flags: checkedonce
Name: "installdaemon"; Description: "Install WinClaw Gateway as a Scheduled Task (auto-start)"; \
  GroupDescription: "Additional options:"; Flags: checkedonce

[Registry]
; Add to PATH (user-level, non-admin safe)
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; \
  ValueData: "{olddata};{app}"; Tasks: addtopath; Check: NeedsAddPath(ExpandConstant('{app}'))

[Run]
; Post-install: run interactive onboarding wizard (visible console for user input)
Filename: "{app}\winclaw.cmd"; Parameters: "onboard --flow quickstart"; \
  StatusMsg: "Starting WinClaw setup wizard..."; \
  Description: "Run WinClaw Setup Wizard (recommended)"; \
  Flags: postinstall waituntilterminated skipifsilent
; Post-install: install daemon (if selected)
Filename: "{app}\winclaw.cmd"; Parameters: "daemon install"; \
  StatusMsg: "Installing Gateway daemon..."; Tasks: installdaemon; \
  Flags: runhidden waituntilterminated

[UninstallRun]
; Pre-uninstall: stop and remove daemon
Filename: "{app}\winclaw.cmd"; Parameters: "daemon uninstall"; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveDaemon"

[Code]
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

// Set WINCLAW_HOME env var and notify explorer of PATH change
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    Exec(ExpandConstant('{sys}\cmd.exe'),
      '/c "setx WINCLAW_HOME "' + ExpandConstant('{app}') + '" >nul 2>&1"',
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
