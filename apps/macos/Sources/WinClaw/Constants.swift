import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-winclaw writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.winclaw.mac"
let gatewayLaunchdLabel = "ai.winclaw.gateway"
let onboardingVersionKey = "winclaw.onboardingVersion"
let onboardingSeenKey = "winclaw.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "winclaw.pauseEnabled"
let iconAnimationsEnabledKey = "winclaw.iconAnimationsEnabled"
let swabbleEnabledKey = "winclaw.swabbleEnabled"
let swabbleTriggersKey = "winclaw.swabbleTriggers"
let voiceWakeTriggerChimeKey = "winclaw.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "winclaw.voiceWakeSendChime"
let showDockIconKey = "winclaw.showDockIcon"
let defaultVoiceWakeTriggers = ["winclaw"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "winclaw.voiceWakeMicID"
let voiceWakeMicNameKey = "winclaw.voiceWakeMicName"
let voiceWakeLocaleKey = "winclaw.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "winclaw.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "winclaw.voicePushToTalkEnabled"
let talkEnabledKey = "winclaw.talkEnabled"
let iconOverrideKey = "winclaw.iconOverride"
let connectionModeKey = "winclaw.connectionMode"
let remoteTargetKey = "winclaw.remoteTarget"
let remoteIdentityKey = "winclaw.remoteIdentity"
let remoteProjectRootKey = "winclaw.remoteProjectRoot"
let remoteCliPathKey = "winclaw.remoteCliPath"
let canvasEnabledKey = "winclaw.canvasEnabled"
let cameraEnabledKey = "winclaw.cameraEnabled"
let systemRunPolicyKey = "winclaw.systemRunPolicy"
let systemRunAllowlistKey = "winclaw.systemRunAllowlist"
let systemRunEnabledKey = "winclaw.systemRunEnabled"
let locationModeKey = "winclaw.locationMode"
let locationPreciseKey = "winclaw.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "winclaw.peekabooBridgeEnabled"
let deepLinkKeyKey = "winclaw.deepLinkKey"
let modelCatalogPathKey = "winclaw.modelCatalogPath"
let modelCatalogReloadKey = "winclaw.modelCatalogReload"
let cliInstallPromptedVersionKey = "winclaw.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "winclaw.heartbeatsEnabled"
let debugPaneEnabledKey = "winclaw.debugPaneEnabled"
let debugFileLogEnabledKey = "winclaw.debug.fileLogEnabled"
let appLogLevelKey = "winclaw.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
