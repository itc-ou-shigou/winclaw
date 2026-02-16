import Foundation
import Testing
@testable import WinClaw

@Suite(.serialized)
struct WinClawConfigFileTests {
    @Test
    func configPathRespectsEnvOverride() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("winclaw-config-\(UUID().uuidString)")
            .appendingPathComponent("winclaw.json")
            .path

        await TestIsolation.withEnvValues(["WINCLAW_CONFIG_PATH": override]) {
            #expect(WinClawConfigFile.url().path == override)
        }
    }

    @MainActor
    @Test
    func remoteGatewayPortParsesAndMatchesHost() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("winclaw-config-\(UUID().uuidString)")
            .appendingPathComponent("winclaw.json")
            .path

        await TestIsolation.withEnvValues(["WINCLAW_CONFIG_PATH": override]) {
            WinClawConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "ws://gateway.ts.net:19999",
                    ],
                ],
            ])
            #expect(WinClawConfigFile.remoteGatewayPort() == 19999)
            #expect(WinClawConfigFile.remoteGatewayPort(matchingHost: "gateway.ts.net") == 19999)
            #expect(WinClawConfigFile.remoteGatewayPort(matchingHost: "gateway") == 19999)
            #expect(WinClawConfigFile.remoteGatewayPort(matchingHost: "other.ts.net") == nil)
        }
    }

    @MainActor
    @Test
    func setRemoteGatewayUrlPreservesScheme() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("winclaw-config-\(UUID().uuidString)")
            .appendingPathComponent("winclaw.json")
            .path

        await TestIsolation.withEnvValues(["WINCLAW_CONFIG_PATH": override]) {
            WinClawConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "wss://old-host:111",
                    ],
                ],
            ])
            WinClawConfigFile.setRemoteGatewayUrl(host: "new-host", port: 2222)
            let root = WinClawConfigFile.loadDict()
            let url = ((root["gateway"] as? [String: Any])?["remote"] as? [String: Any])?["url"] as? String
            #expect(url == "wss://new-host:2222")
        }
    }

    @Test
    func stateDirOverrideSetsConfigPath() async {
        let dir = FileManager().temporaryDirectory
            .appendingPathComponent("winclaw-state-\(UUID().uuidString)", isDirectory: true)
            .path

        await TestIsolation.withEnvValues([
            "WINCLAW_CONFIG_PATH": nil,
            "WINCLAW_STATE_DIR": dir,
        ]) {
            #expect(WinClawConfigFile.stateDirURL().path == dir)
            #expect(WinClawConfigFile.url().path == "\(dir)/winclaw.json")
        }
    }
}
