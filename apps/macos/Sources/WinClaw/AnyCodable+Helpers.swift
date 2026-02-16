import WinClawKit
import WinClawProtocol
import Foundation

// Prefer the WinClawKit wrapper to keep gateway request payloads consistent.
typealias AnyCodable = WinClawKit.AnyCodable
typealias InstanceIdentity = WinClawKit.InstanceIdentity

extension AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: AnyCodable]? { self.value as? [String: AnyCodable] }
    var arrayValue: [AnyCodable]? { self.value as? [AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}

extension WinClawProtocol.AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: WinClawProtocol.AnyCodable]? { self.value as? [String: WinClawProtocol.AnyCodable] }
    var arrayValue: [WinClawProtocol.AnyCodable]? { self.value as? [WinClawProtocol.AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: WinClawProtocol.AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [WinClawProtocol.AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}
