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

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
