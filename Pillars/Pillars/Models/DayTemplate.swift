//
//  DayTemplate.swift
//  Pillars
//
//  A reusable list of block type IDs that pre-populates a new Day
//

import Foundation

// MARK: - TemplateEntry

struct TemplateEntry: Identifiable, Codable {
    let id: String
    var blockTypeId: String
    var order: Int
    var defaultChecklistItems: [String]?
}

// MARK: - TemplateSectionDef

struct TemplateSectionDef: Codable, Identifiable {
    var id: DaySection.TimeSection
    var entries: [TemplateEntry]
}

// MARK: - DayTemplate

struct DayTemplate: Identifiable, Codable {
    let id: String
    let userId: String
    var name: String
    var isDefault: Bool
    var sections: [TemplateSectionDef]
    let createdAt: Date
    var updatedAt: Date
}

// MARK: - Built-in Default Template

extension DayTemplate {
    /// Built-in fallback — used when no Firestore template exists
    static func builtInDefault(userId: String) -> DayTemplate {
        let now = Date()
        return DayTemplate(
            id: "built-in-default",
            userId: userId,
            name: "Default",
            isDefault: true,
            sections: [
                TemplateSectionDef(id: .morning, entries: [
                    TemplateEntry(id: UUID().uuidString, blockTypeId: "sleep", order: 0, defaultChecklistItems: nil),
                    TemplateEntry(id: UUID().uuidString, blockTypeId: "feeling", order: 1, defaultChecklistItems: nil),
                    TemplateEntry(id: UUID().uuidString, blockTypeId: "morningHabits", order: 2,
                                  defaultChecklistItems: ["Exercise", "Meditate", "Read"])
                ]),
                TemplateSectionDef(id: .afternoon, entries: [
                    TemplateEntry(id: UUID().uuidString, blockTypeId: "workout", order: 0, defaultChecklistItems: nil),
                    TemplateEntry(id: UUID().uuidString, blockTypeId: "todos", order: 1, defaultChecklistItems: nil)
                ]),
                TemplateSectionDef(id: .evening, entries: [
                    TemplateEntry(id: UUID().uuidString, blockTypeId: "reflection", order: 0, defaultChecklistItems: nil)
                ])
            ],
            createdAt: now,
            updatedAt: now
        )
    }
}
