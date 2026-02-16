import Foundation

public enum WinClawDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum WinClawBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum WinClawThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum WinClawNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum WinClawNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct WinClawBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: WinClawBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: WinClawBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct WinClawThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: WinClawThermalState

    public init(state: WinClawThermalState) {
        self.state = state
    }
}

public struct WinClawStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct WinClawNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: WinClawNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [WinClawNetworkInterfaceType]

    public init(
        status: WinClawNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [WinClawNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct WinClawDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: WinClawBatteryStatusPayload
    public var thermal: WinClawThermalStatusPayload
    public var storage: WinClawStorageStatusPayload
    public var network: WinClawNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: WinClawBatteryStatusPayload,
        thermal: WinClawThermalStatusPayload,
        storage: WinClawStorageStatusPayload,
        network: WinClawNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct WinClawDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
