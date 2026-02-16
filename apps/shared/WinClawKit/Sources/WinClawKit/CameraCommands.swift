import Foundation

public enum WinClawCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum WinClawCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum WinClawCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum WinClawCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct WinClawCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: WinClawCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: WinClawCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: WinClawCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: WinClawCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct WinClawCameraClipParams: Codable, Sendable, Equatable {
    public var facing: WinClawCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: WinClawCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: WinClawCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: WinClawCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
