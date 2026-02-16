import Foundation

public enum WinClawChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(WinClawChatEventPayload)
    case agent(WinClawAgentEventPayload)
    case seqGap
}

public protocol WinClawChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> WinClawChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [WinClawChatAttachmentPayload]) async throws -> WinClawChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> WinClawChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<WinClawChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension WinClawChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "WinClawChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> WinClawChatSessionsListResponse {
        throw NSError(
            domain: "WinClawChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
