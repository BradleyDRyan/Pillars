//
//  Todo.swift
//  Pillars
//
//  Todo model shared across Todo/My Day views.
//

import Foundation

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
    let bountyPillarId: String?
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
}
