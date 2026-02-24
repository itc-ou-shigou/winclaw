import CoreLocation
import Foundation
import WinClawKit
import UIKit

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: WinClawCameraSnapParams) async throws -> (format: String, base64: String, width: Int, height: Int)
    func clip(params: WinClawCameraClipParams) async throws -> (format: String, base64: String, durationMs: Int, hasAudio: Bool)
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: WinClawLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: WinClawLocationGetParams,
        desiredAccuracy: WinClawLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: OpenClawLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

protocol DeviceStatusServicing: Sendable {
    func status() async throws -> WinClawDeviceStatusPayload
    func info() -> WinClawDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: WinClawPhotosLatestParams) async throws -> WinClawPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: WinClawContactsSearchParams) async throws -> WinClawContactsSearchPayload
    func add(params: WinClawContactsAddParams) async throws -> WinClawContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: WinClawCalendarEventsParams) async throws -> WinClawCalendarEventsPayload
    func add(params: WinClawCalendarAddParams) async throws -> WinClawCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: WinClawRemindersListParams) async throws -> WinClawRemindersListPayload
    func add(params: WinClawRemindersAddParams) async throws -> WinClawRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: WinClawMotionActivityParams) async throws -> WinClawMotionActivityPayload
    func pedometer(params: WinClawPedometerParams) async throws -> WinClawPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: OpenClawWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
