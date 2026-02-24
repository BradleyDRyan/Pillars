import Foundation

enum ActionStatus: String, Codable, CaseIterable {
    case pending
    case completed
    case skipped
    case canceled

    var isDone: Bool {
        self != .pending
    }
}

struct ActionBounty: Codable, Hashable {
    let pillarId: String
    let rubricItemId: String?
    let points: Int
}

struct Action: Decodable, Identifiable {
    let id: String
    let userId: String?
    let title: String
    let notes: String?
    let status: ActionStatus
    let targetDate: String
    let sectionId: String?
    let order: Int?
    let templateId: String?
    let bounties: [ActionBounty]
    let completedAt: TimeInterval?
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?
    let archivedAt: TimeInterval?
    let source: String?

    var section: DaySection.TimeSection {
        guard let sectionId else { return .afternoon }
        return DaySection.TimeSection(rawValue: sectionId) ?? .afternoon
    }

    var isRecurring: Bool {
        guard let templateId else { return false }
        return !templateId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var totalBountyPoints: Int {
        bounties.reduce(0) { $0 + max(0, $1.points) }
    }
}

struct ActionMutationResponse: Decodable {
    let action: Action
    let classificationSummary: ActionClassificationSummary?
}

struct ActionClassificationSummary: Decodable {
    let matchedPillarIds: [String]?
    let trimmedPillarIds: [String]?
    let method: String?
    let fallbackUsed: Bool?
    let modelUsed: String?
    let modelRationale: String?
    let modelSystemPrompt: String?
    let modelUserPrompt: String?
    let modelResponseRaw: String?
}

struct ActionsByDateResponse: Decodable {
    let date: String
    let ensure: Bool
    let ensuredCreatedCount: Int
    let items: [Action]
    let count: Int
}
