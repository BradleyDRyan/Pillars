//
//  BlockType.swift
//  Pillars
//
//  API-backed block type definitions with local fallback.
//

import Foundation

enum BlockInputKind {
    case sleep
    case sliders
    case checklist
    case textFields
    case freeText
    case custom
}

struct BlockTypeFieldSchema: Codable, Identifiable {
    let id: String
    let label: String
    let type: String
    let min: Double?
    let max: Double?
    let options: [String]?
    let required: Bool?
}

struct BlockTypeDataSchema: Codable {
    let fields: [BlockTypeFieldSchema]
}

struct BlockType: Identifiable, Codable {
    let id: String
    var userId: String?
    var name: String
    var icon: String
    var color: String
    var category: String
    var defaultSection: DaySection.TimeSection
    var subtitleTemplate: String
    var dataSchema: BlockTypeDataSchema
    var isDeletable: Bool
    var createdAt: TimeInterval?
    var updatedAt: TimeInterval?

    var isBuiltIn: Bool {
        category == "built-in"
    }

    var description: String {
        switch id {
        case "sleep":
            return "Track sleep score, quality, and duration."
        case "feeling":
            return "Log energy, mood, and stress."
        case "workout":
            return "Capture workout type, duration, and notes."
        case "reflection":
            return "Journal a free-text reflection."
        case "todo":
            return "Task primitive projected into your day."
        case "habits":
            return "Habit primitive projected into your day."
        default:
            return "Custom block type."
        }
    }

    var inputKind: BlockInputKind {
        switch id {
        case "sleep":
            return .sleep
        case "feeling":
            return .sliders
        case "workout":
            return .textFields
        case "reflection":
            return .freeText
        case "todo", "habits":
            return .checklist
        default:
            return .custom
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case userId
        case name
        case icon
        case color
        case category
        case defaultSection
        case subtitleTemplate
        case dataSchema
        case isDeletable
        case createdAt
        case updatedAt
    }

    init(
        id: String,
        userId: String? = nil,
        name: String,
        icon: String,
        color: String,
        category: String,
        defaultSection: DaySection.TimeSection,
        subtitleTemplate: String,
        dataSchema: BlockTypeDataSchema,
        isDeletable: Bool,
        createdAt: TimeInterval? = nil,
        updatedAt: TimeInterval? = nil
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.icon = icon
        self.color = color
        self.category = category
        self.defaultSection = defaultSection
        self.subtitleTemplate = subtitleTemplate
        self.dataSchema = dataSchema
        self.isDeletable = isDeletable
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)
        name = try container.decode(String.self, forKey: .name)
        icon = try container.decodeIfPresent(String.self, forKey: .icon) ?? "🧩"
        color = try container.decodeIfPresent(String.self, forKey: .color) ?? "#64748b"
        category = try container.decodeIfPresent(String.self, forKey: .category) ?? "custom"

        let defaultSectionRaw = try container.decodeIfPresent(String.self, forKey: .defaultSection) ?? "afternoon"
        defaultSection = DaySection.TimeSection(rawValue: defaultSectionRaw) ?? .afternoon

        subtitleTemplate = try container.decodeIfPresent(String.self, forKey: .subtitleTemplate) ?? ""
        dataSchema = try container.decodeIfPresent(BlockTypeDataSchema.self, forKey: .dataSchema)
            ?? BlockTypeDataSchema(fields: [])
        isDeletable = try container.decodeIfPresent(Bool.self, forKey: .isDeletable) ?? (category != "built-in")
        createdAt = try container.decodeIfPresent(TimeInterval.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(TimeInterval.self, forKey: .updatedAt)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(userId, forKey: .userId)
        try container.encode(name, forKey: .name)
        try container.encode(icon, forKey: .icon)
        try container.encode(color, forKey: .color)
        try container.encode(category, forKey: .category)
        try container.encode(defaultSection.rawValue, forKey: .defaultSection)
        try container.encode(subtitleTemplate, forKey: .subtitleTemplate)
        try container.encode(dataSchema, forKey: .dataSchema)
        try container.encode(isDeletable, forKey: .isDeletable)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
    }
}

extension BlockType {
    static let fallbackBuiltIns: [BlockType] = [
        BlockType(
            id: "sleep",
            name: "Sleep",
            icon: "🛏️",
            color: "#6366f1",
            category: "built-in",
            defaultSection: .morning,
            subtitleTemplate: "{score}% · {durationHours}h",
            dataSchema: BlockTypeDataSchema(fields: [
                BlockTypeFieldSchema(id: "score", label: "Sleep Score", type: "number", min: 0, max: 100, options: nil, required: nil),
                BlockTypeFieldSchema(id: "quality", label: "Quality", type: "number", min: 1, max: 5, options: nil, required: nil),
                BlockTypeFieldSchema(id: "durationHours", label: "Duration", type: "number", min: 0, max: nil, options: nil, required: nil)
            ]),
            isDeletable: false
        ),
        BlockType(
            id: "feeling",
            name: "Feeling",
            icon: "😊",
            color: "#0ea5e9",
            category: "built-in",
            defaultSection: .morning,
            subtitleTemplate: "Energy {energy} · Mood {mood}",
            dataSchema: BlockTypeDataSchema(fields: [
                BlockTypeFieldSchema(id: "energy", label: "Energy", type: "number", min: 0, max: 10, options: nil, required: nil),
                BlockTypeFieldSchema(id: "mood", label: "Mood", type: "number", min: 0, max: 10, options: nil, required: nil),
                BlockTypeFieldSchema(id: "stress", label: "Stress", type: "number", min: 0, max: 10, options: nil, required: nil)
            ]),
            isDeletable: false
        ),
        BlockType(
            id: "workout",
            name: "Workout",
            icon: "🏋️",
            color: "#f97316",
            category: "built-in",
            defaultSection: .afternoon,
            subtitleTemplate: "{type} · {duration}",
            dataSchema: BlockTypeDataSchema(fields: []),
            isDeletable: false
        ),
        BlockType(
            id: "reflection",
            name: "Reflection",
            icon: "🌙",
            color: "#334155",
            category: "built-in",
            defaultSection: .evening,
            subtitleTemplate: "{freeText:truncate50}",
            dataSchema: BlockTypeDataSchema(fields: []),
            isDeletable: false
        ),
        BlockType(
            id: "habits",
            name: "Habit",
            icon: "✅",
            color: "#22c55e",
            category: "built-in",
            defaultSection: .morning,
            subtitleTemplate: "{status}",
            dataSchema: BlockTypeDataSchema(fields: []),
            isDeletable: false
        ),
        BlockType(
            id: "todo",
            name: "Todo",
            icon: "☑️",
            color: "#0f766e",
            category: "built-in",
            defaultSection: .afternoon,
            subtitleTemplate: "{status}",
            dataSchema: BlockTypeDataSchema(fields: []),
            isDeletable: false
        )
    ]

    private static var cachedTypes: [BlockType] = fallbackBuiltIns

    static var all: [BlockType] {
        cachedTypes
    }

    static var builtIns: [BlockType] {
        cachedTypes.filter { $0.category == "built-in" }
    }

    static var custom: [BlockType] {
        cachedTypes.filter { $0.category != "built-in" }
    }

    static func setCached(_ types: [BlockType]) {
        guard !types.isEmpty else {
            cachedTypes = fallbackBuiltIns
            return
        }
        cachedTypes = types
    }

    static func resetToFallback() {
        cachedTypes = fallbackBuiltIns
    }

    static func find(_ id: String) -> BlockType? {
        cachedTypes.first(where: { $0.id == id })
    }
}
