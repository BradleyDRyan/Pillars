//
//  CustomBlockType.swift
//  Pillars
//
//  Firestore-backed custom block type definitions created by AI agents
//

import Foundation

struct CustomBlockType: Identifiable, Codable {
    let id: String
    let userId: String
    var name: String
    var icon: String
    var description: String
    var defaultSection: DaySection.TimeSection
    var fields: [CustomFieldDef]
    let createdAt: Date
    var updatedAt: Date
}

struct CustomFieldDef: Identifiable, Codable {
    let id: String
    var label: String
    var type: CustomFieldType
    var placeholder: String?
    var min: Double?
    var max: Double?
    var step: Double?
    var isRequired: Bool
}

enum CustomFieldType: String, Codable {
    case text
    case multiline
    case number
    case slider
    case toggle
    case rating
}
