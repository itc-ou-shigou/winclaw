import Foundation

public enum WinClawRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum WinClawReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct WinClawRemindersListParams: Codable, Sendable, Equatable {
    public var status: WinClawReminderStatusFilter?
    public var limit: Int?

    public init(status: WinClawReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct WinClawRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct WinClawReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct WinClawRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [WinClawReminderPayload]

    public init(reminders: [WinClawReminderPayload]) {
        self.reminders = reminders
    }
}

public struct WinClawRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: WinClawReminderPayload

    public init(reminder: WinClawReminderPayload) {
        self.reminder = reminder
    }
}
