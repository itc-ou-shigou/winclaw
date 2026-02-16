// swift-tools-version: 6.2
// Package manifest for the WinClaw macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "WinClaw",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "WinClawIPC", targets: ["WinClawIPC"]),
        .library(name: "WinClawDiscovery", targets: ["WinClawDiscovery"]),
        .executable(name: "WinClaw", targets: ["WinClaw"]),
        .executable(name: "winclaw-mac", targets: ["WinClawMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/WinClawKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "WinClawIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "WinClawDiscovery",
            dependencies: [
                .product(name: "WinClawKit", package: "WinClawKit"),
            ],
            path: "Sources/WinClawDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "WinClaw",
            dependencies: [
                "WinClawIPC",
                "WinClawDiscovery",
                .product(name: "WinClawKit", package: "WinClawKit"),
                .product(name: "WinClawChatUI", package: "WinClawKit"),
                .product(name: "WinClawProtocol", package: "WinClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/WinClaw.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "WinClawMacCLI",
            dependencies: [
                "WinClawDiscovery",
                .product(name: "WinClawKit", package: "WinClawKit"),
                .product(name: "WinClawProtocol", package: "WinClawKit"),
            ],
            path: "Sources/WinClawMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "WinClawIPCTests",
            dependencies: [
                "WinClawIPC",
                "WinClaw",
                "WinClawDiscovery",
                .product(name: "WinClawProtocol", package: "WinClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
