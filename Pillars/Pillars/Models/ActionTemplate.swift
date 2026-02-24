import Foundation

enum ActionCadenceType: String, Codable, CaseIterable {
    case daily
    case weekdays
    case weekly
}

struct ActionCadence: Codable, Hashable {
    let type: ActionCadenceType
    let daysOfWeek: [String]?
}

struct ActionTemplate: Decodable, Identifiable {
    let id: String
    let userId: String?
    let title: String
    let notes: String?
    let cadence: ActionCadence
    let defaultSectionId: String?
    let defaultOrder: Int?
    let defaultBounties: [ActionBounty]
    let isActive: Bool
    let startDate: String?
    let endDate: String?
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?
    let archivedAt: TimeInterval?

    var defaultSection: DaySection.TimeSection {
        guard let defaultSectionId else { return .afternoon }
        return DaySection.TimeSection(rawValue: defaultSectionId) ?? .afternoon
    }
}

struct ActionTemplateMutationResponse: Decodable {
    let actionTemplate: ActionTemplate
    let propagatedActionsCount: Int?
    let classificationSummary: ActionClassificationSummary?
}

struct ActionTemplateListResponse: Decodable {
    let items: [ActionTemplate]
    let count: Int
}
