//
//  Todo.swift
//  Pillars
//
//  Todo model shared across Todo/My Day views.
//

import Foundation

enum TodoAssignmentMode: String, Codable, CaseIterable {
    case auto
    case manual
}

struct TodoAssignmentSelection: Equatable {
    var mode: TodoAssignmentMode
    var pillarIds: [String]

    static var auto: TodoAssignmentSelection {
        TodoAssignmentSelection(mode: .auto, pillarIds: [])
    }

    static func manual(_ pillarIds: [String]) -> TodoAssignmentSelection {
        let deduped = Array(NSOrderedSet(array: pillarIds)) as? [String] ?? pillarIds
        return TodoAssignmentSelection(mode: .manual, pillarIds: deduped)
    }
}

struct TodoBountyAllocation: Codable, Hashable, Identifiable {
    let pillarId: String
    let points: Int

    var id: String { pillarId }
}

struct TodoClassificationSummary: Codable, Hashable {
    let matchedPillarIds: [String]
    let trimmedPillarIds: [String]
    let method: String?
}

struct Todo: Decodable, Identifiable {
    let id: String
    let content: String
    let description: String?
    let dueDate: String?
    let sectionId: String?
    let status: String?
    let pillarId: String?
    let parentId: String?
    let bountyPoints: Int?
    let bountyAllocations: [TodoBountyAllocation]?
    let bountyPillarId: String?
    let assignmentMode: String?
    let bountyPaidAt: TimeInterval?
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?
    let completedAt: TimeInterval?
    let archivedAt: TimeInterval?

    var isCompleted: Bool {
        status == "completed"
    }

    var section: DaySection.TimeSection {
        guard let sectionId else { return .afternoon }
        return DaySection.TimeSection(rawValue: sectionId) ?? .afternoon
    }

    var resolvedBountyPoints: Int? {
        if let bountyPoints, bountyPoints > 0 {
            return bountyPoints
        }
        guard let bountyAllocations else { return nil }
        let total = bountyAllocations.reduce(0) { $0 + max(0, $1.points) }
        return total > 0 ? total : nil
    }

    var allocationPillarIds: [String] {
        let fromAllocations = bountyAllocations?.map(\.pillarId).filter { !$0.isEmpty } ?? []
        if !fromAllocations.isEmpty {
            return Array(NSOrderedSet(array: fromAllocations)) as? [String] ?? fromAllocations
        }

        guard let pillarId, !pillarId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return []
        }
        return [pillarId]
    }

    var assignmentSelection: TodoAssignmentSelection {
        let normalizedMode = assignmentMode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedMode == TodoAssignmentMode.auto.rawValue {
            return .auto
        }

        let pillarIds = allocationPillarIds
        if normalizedMode == TodoAssignmentMode.manual.rawValue || !pillarIds.isEmpty {
            return .manual(pillarIds)
        }

        return .auto
    }
}
