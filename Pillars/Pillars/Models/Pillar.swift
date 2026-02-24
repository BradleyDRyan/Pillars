//
//  Pillar.swift
//  Pillars
//
//  A major domain of life (e.g., Work, Relationship, Health)
//

import Foundation
import SwiftUI

private func normalizePillarIconToken(_ raw: String?) -> String? {
    guard let raw else { return nil }
    let trimmed = raw
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
    return trimmed.isEmpty ? nil : trimmed
}

private func normalizePillarContextMarkdown(_ raw: String?) -> String? {
    guard let raw else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
        return nil
    }
    return trimmed
}

private func buildPillarContextMarkdown(from lines: [String]?) -> String? {
    guard let lines else { return nil }
    let normalized = lines
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
    guard !normalized.isEmpty else {
        return nil
    }
    return normalized.map { "- \($0)" }.joined(separator: "\n")
}

enum PillarType: String, Codable, CaseIterable {
    case marriage
    case physical
    case career
    case finances
    case house
    case mentalHealth = "mental_health"
    case spiritual
    case fatherhood
    case custom

    static func resolve(_ raw: String?) -> PillarType? {
        guard let normalizedRaw = raw?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased(),
              !normalizedRaw.isEmpty else {
            return nil
        }

        switch normalizedRaw {
        case "marriage", "relationship", "spouse", "partner":
            return .marriage
        case "fatherhood", "parenting", "father", "dad":
            return .fatherhood
        case "family", "friendship", "friendships":
            return .custom
        case "physical", "fitness", "health":
            return .physical
        case "career", "work", "business":
            return .career
        case "finances", "finance", "money":
            return .finances
        case "house", "home":
            return .house
        case "mental_health", "mentalhealth", "mental", "mind", "self":
            return .mentalHealth
        case "spiritual", "faith", "spirit":
            return .spiritual
        case "custom":
            return .custom
        default:
            return nil
        }
    }

    static func infer(name: String, icon: PillarIcon?) -> PillarType? {
        infer(name: name, iconToken: icon?.rawValue)
    }

    static func infer(name: String, iconToken: String?) -> PillarType? {
        if let inferredFromIcon = infer(from: iconToken) {
            return inferredFromIcon
        }

        let normalizedName = name
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !normalizedName.isEmpty else {
            return nil
        }

        if let direct = resolve(normalizedName) {
            return direct
        }

        if normalizedName.contains("marriage")
            || normalizedName.contains("relationship")
            || normalizedName.contains("spouse")
            || normalizedName.contains("partner") {
            return .marriage
        }

        if normalizedName.contains("father")
            || normalizedName.contains("dad")
            || normalizedName.contains("parent") {
            return .fatherhood
        }

        if normalizedName.contains("physical")
            || normalizedName.contains("fitness")
            || normalizedName.contains("health") {
            return .physical
        }

        if normalizedName.contains("career")
            || normalizedName.contains("work")
            || normalizedName.contains("business") {
            return .career
        }

        if normalizedName.contains("finance")
            || normalizedName.contains("money") {
            return .finances
        }

        if normalizedName.contains("house")
            || normalizedName.contains("home") {
            return .house
        }

        if normalizedName.contains("mental")
            || normalizedName.contains("mind")
            || normalizedName.contains("self") {
            return .mentalHealth
        }

        if normalizedName.contains("spiritual")
            || normalizedName.contains("faith") {
            return .spiritual
        }

        return nil
    }

    private static func infer(from iconToken: String?) -> PillarType? {
        switch normalizePillarIconToken(iconToken) {
        case "heart":
            return .marriage
        case "figure2":
            return .fatherhood
        case "figure":
            return .physical
        case "briefcase":
            return .career
        case "dollarsign", "creditcard":
            return .finances
        case "house":
            return .house
        case "brain":
            return .mentalHealth
        case "leaf":
            return .spiritual
        default:
            return nil
        }
    }

}

struct PillarRubricItem: Codable, Hashable, Identifiable {
    let id: String
    var activityType: String
    var tier: String
    var label: String
    var points: Int
    var examples: String?
    var createdAt: TimeInterval?
    var updatedAt: TimeInterval?

    init(
        id: String,
        activityType: String,
        tier: String,
        label: String? = nil,
        points: Int,
        examples: String? = nil,
        createdAt: TimeInterval? = nil,
        updatedAt: TimeInterval? = nil
    ) {
        self.id = id
        self.activityType = activityType
        self.tier = tier
        self.label = (label?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
            ? (label ?? "")
            : "\(activityType) - \(tier)"
        self.points = points
        self.examples = examples
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var displayLabel: String {
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return "\(activityType) - \(tier)"
        }
        return trimmed
    }

    var firestoreData: [String: Any] {
        [
            "id": id,
            "activityType": activityType,
            "tier": tier,
            "label": label,
            "points": points,
            "examples": examples ?? NSNull(),
            "createdAt": createdAt ?? Date().timeIntervalSince1970,
            "updatedAt": updatedAt ?? Date().timeIntervalSince1970
        ]
    }
}

struct PillarTemplate: Codable, Hashable, Identifiable {
    let pillarType: String
    var name: String
    var description: String?
    var iconToken: String?
    var colorToken: String?
    var order: Int
    var isActive: Bool
    var rubricItems: [PillarRubricItem]

    var id: String { pillarType }
    var icon: PillarIcon? { PillarIcon.resolve(iconToken) }

    enum CodingKeys: String, CodingKey {
        case pillarType, name, description, icon, colorToken, order, isActive, rubricItems
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        pillarType = try container.decode(String.self, forKey: .pillarType)
        name = try container.decode(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        let iconRaw = try container.decodeIfPresent(String.self, forKey: .icon)
        iconToken = normalizePillarIconToken(iconRaw)
        colorToken = try container.decodeIfPresent(String.self, forKey: .colorToken)
        order = try container.decodeIfPresent(Int.self, forKey: .order) ?? 0
        isActive = try container.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
        rubricItems = try container.decodeIfPresent([PillarRubricItem].self, forKey: .rubricItems) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(pillarType, forKey: .pillarType)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(iconToken, forKey: .icon)
        try container.encodeIfPresent(colorToken, forKey: .colorToken)
        try container.encode(order, forKey: .order)
        try container.encode(isActive, forKey: .isActive)
        try container.encode(rubricItems, forKey: .rubricItems)
    }
}

struct Pillar: Identifiable, Codable, Hashable {
    let id: String
    let userId: String
    var name: String
    var pillarType: PillarType?
    var description: String
    var color: String
    var colorToken: String?
    var customColorHex: String?
    var iconToken: String?
    var emoji: String?
    var isDefault: Bool
    var isArchived: Bool
    var rubricItems: [PillarRubricItem]
    var settings: [String: String]?
    var stats: PillarStats
    let createdAt: Date
    var updatedAt: Date
    var metadata: [String: String]?
    var contextMarkdown: String?

    var icon: PillarIcon? { PillarIcon.resolve(iconToken) }
    
    struct PillarStats: Codable, Hashable {
        var conversationCount: Int
        var principleCount: Int
        var wisdomCount: Int
        var resourceCount: Int
        var pointEventCount: Int
        var pointTotal: Int
        
        init(conversationCount: Int = 0, principleCount: Int = 0, wisdomCount: Int = 0, resourceCount: Int = 0, pointEventCount: Int = 0, pointTotal: Int = 0) {
            self.conversationCount = conversationCount
            self.principleCount = principleCount
            self.wisdomCount = wisdomCount
            self.resourceCount = resourceCount
            self.pointEventCount = pointEventCount
            self.pointTotal = pointTotal
        }
    }
    
    enum CodingKeys: String, CodingKey {
        case id, userId, name, pillarType, description, color, colorToken, customColorHex, icon, emoji
        case isDefault, isArchived, rubricItems, settings, stats
        case createdAt, updatedAt, metadata
        case contextMarkdown, context, factsMarkdown, facts
    }
    
    init(id: String, userId: String, name: String, description: String = "", color: String = "#000000",
         colorToken: String? = nil, customColorHex: String? = nil,
         pillarType: PillarType? = nil, iconToken: String? = nil, icon: PillarIcon? = nil, emoji: String? = nil, isDefault: Bool = false, isArchived: Bool = false,
         rubricItems: [PillarRubricItem] = [], settings: [String: String]? = nil, stats: PillarStats = PillarStats(), createdAt: Date = Date(), updatedAt: Date = Date(),
         metadata: [String: String]? = nil, contextMarkdown: String? = nil) {
        let normalizedIconToken = normalizePillarIconToken(iconToken) ?? icon?.rawValue
        self.id = id
        self.userId = userId
        self.name = name
        self.pillarType = pillarType ?? PillarType.infer(name: name, iconToken: normalizedIconToken)
        self.description = description
        self.color = color
        self.colorToken = colorToken
        self.customColorHex = customColorHex
        self.iconToken = normalizedIconToken
        self.emoji = emoji
        self.isDefault = isDefault
        self.isArchived = isArchived
        self.rubricItems = rubricItems
        self.settings = settings
        self.stats = stats
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.metadata = metadata
        self.contextMarkdown = normalizePillarContextMarkdown(contextMarkdown)
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        userId = try container.decode(String.self, forKey: .userId)
        name = try container.decode(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        color = try container.decodeIfPresent(String.self, forKey: .color) ?? "#000000"
        colorToken = try container.decodeIfPresent(String.self, forKey: .colorToken)
        customColorHex = try container.decodeIfPresent(String.self, forKey: .customColorHex)
        emoji = try container.decodeIfPresent(String.self, forKey: .emoji)
        
        let iconString = try container.decodeIfPresent(String.self, forKey: .icon)
        iconToken = normalizePillarIconToken(iconString)
        let rawPillarType = try container.decodeIfPresent(String.self, forKey: .pillarType)
        pillarType = PillarType.resolve(rawPillarType) ?? PillarType.infer(name: name, iconToken: iconToken)
        
        isDefault = try container.decodeIfPresent(Bool.self, forKey: .isDefault) ?? false
        isArchived = try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
        rubricItems = try container.decodeIfPresent([PillarRubricItem].self, forKey: .rubricItems) ?? []
        settings = try container.decodeIfPresent([String: String].self, forKey: .settings)
        stats = try container.decodeIfPresent(PillarStats.self, forKey: .stats) ?? PillarStats()
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        // Backend metadata can include nested objects (for example templateSource),
        // so decode string-only metadata best-effort without failing the whole model decode.
        metadata = try? container.decode([String: String].self, forKey: .metadata)
        let directContextMarkdown = (try? container.decodeIfPresent(String.self, forKey: .contextMarkdown)) ?? nil
        let directContext = (try? container.decodeIfPresent(String.self, forKey: .context)) ?? nil
        let legacyFactsMarkdown = (try? container.decodeIfPresent(String.self, forKey: .factsMarkdown)) ?? nil
        let legacyFactsString = (try? container.decodeIfPresent(String.self, forKey: .facts)) ?? nil
        let legacyFactsList = (try? container.decodeIfPresent([String].self, forKey: .facts)) ?? nil
        contextMarkdown = normalizePillarContextMarkdown(
            directContextMarkdown
                ?? directContext
                ?? legacyFactsMarkdown
                ?? legacyFactsString
                ?? buildPillarContextMarkdown(from: legacyFactsList)
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(userId, forKey: .userId)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(pillarType?.rawValue, forKey: .pillarType)
        try container.encode(description, forKey: .description)
        try container.encode(color, forKey: .color)
        try container.encodeIfPresent(colorToken, forKey: .colorToken)
        try container.encodeIfPresent(customColorHex, forKey: .customColorHex)
        try container.encodeIfPresent(iconToken, forKey: .icon)
        try container.encodeIfPresent(emoji, forKey: .emoji)
        try container.encode(isDefault, forKey: .isDefault)
        try container.encode(isArchived, forKey: .isArchived)
        try container.encode(rubricItems, forKey: .rubricItems)
        try container.encodeIfPresent(settings, forKey: .settings)
        try container.encode(stats, forKey: .stats)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(metadata, forKey: .metadata)
        try container.encodeIfPresent(contextMarkdown, forKey: .contextMarkdown)
    }
    
    var colorValue: Color {
        Color(hex: color)
    }

    static func setBackendDefaultRubricItemsByType(_ templates: [PillarType: [PillarRubricItem]]) {
        guard !templates.isEmpty else { return }
        backendDefaultRubricItemsByType = templates
    }

    var displayRubricItems: [PillarRubricItem] {
        return rubricItems
    }

    static func defaultRubricItems(
        for pillarName: String,
        icon: PillarIcon? = nil,
        iconToken: String? = nil,
        pillarType: PillarType? = nil
    ) -> [PillarRubricItem] {
        let resolvedIconToken = normalizePillarIconToken(iconToken) ?? icon?.rawValue
        let resolvedType = pillarType ?? PillarType.infer(name: pillarName, iconToken: resolvedIconToken)

        if let resolvedType,
           let backendTemplate = backendDefaultRubricItemsByType[resolvedType],
           !backendTemplate.isEmpty {
            return backendTemplate
        }
        if resolvedType == .marriage {
            return marriageDefaultItems
        }
        if resolvedType == .physical {
            return physicalDefaultItems
        }
        if resolvedType == .career {
            return [
                PillarRubricItem(id: "ri_career_deep_work", activityType: "Deep Work", tier: "Focused Session", points: 30),
                PillarRubricItem(id: "ri_career_deliverable", activityType: "Leverage", tier: "High-Impact Deliverable", points: 50),
                PillarRubricItem(id: "ri_career_growth", activityType: "Growth", tier: "Skill Development", points: 25)
            ]
        }
        if resolvedType == .finances {
            return [
                PillarRubricItem(id: "ri_finances_budget", activityType: "Planning", tier: "Budget Review", points: 20),
                PillarRubricItem(id: "ri_finances_action", activityType: "Execution", tier: "Debt / Savings Action", points: 35),
                PillarRubricItem(id: "ri_finances_major", activityType: "Optimization", tier: "Major Financial Decision", points: 50)
            ]
        }
        if resolvedType == .house {
            return [
                PillarRubricItem(id: "ri_house_routine", activityType: "Maintenance", tier: "Routine", points: 15),
                PillarRubricItem(id: "ri_house_reset", activityType: "Organization", tier: "Reset", points: 25),
                PillarRubricItem(id: "ri_house_project", activityType: "Project", tier: "Major Improvement", points: 45)
            ]
        }
        if resolvedType == .mentalHealth {
            return [
                PillarRubricItem(id: "ri_mental_reset", activityType: "Recovery", tier: "Quick Reset", points: 15),
                PillarRubricItem(id: "ri_mental_care", activityType: "Care", tier: "Intentional Practice", points: 30),
                PillarRubricItem(id: "ri_mental_support", activityType: "Support", tier: "Therapy / Coaching", points: 45)
            ]
        }
        if resolvedType == .spiritual {
            return [
                PillarRubricItem(id: "ri_spiritual_practice", activityType: "Connection", tier: "Daily Practice", points: 20),
                PillarRubricItem(id: "ri_spiritual_reflection", activityType: "Study", tier: "Focused Reflection", points: 30),
                PillarRubricItem(id: "ri_spiritual_service", activityType: "Service", tier: "Meaningful Contribution", points: 45)
            ]
        }
        if resolvedType == .fatherhood {
            return [
                PillarRubricItem(id: "ri_fatherhood_quality_light", activityType: "Quality Time", tier: "Light", points: 15, examples: "Played together, bedtime routine"),
                PillarRubricItem(id: "ri_fatherhood_quality_significant", activityType: "Quality Time", tier: "Significant", points: 50, examples: "Planned outing together"),
                PillarRubricItem(id: "ri_fatherhood_teaching", activityType: "Teaching Moment", tier: "Standard", points: 25, examples: "Taught a skill, homework help"),
                PillarRubricItem(id: "ri_fatherhood_caretaking", activityType: "Caretaking", tier: "Standard", points: 20, examples: "Handled school event or logistics"),
                PillarRubricItem(id: "ri_fatherhood_family_experience", activityType: "Family Experience", tier: "Standard", points: 45, examples: "Family trip or tradition")
            ]
        }

        return []
    }

    private static var backendDefaultRubricItemsByType: [PillarType: [PillarRubricItem]] = [:]

    private static var marriageDefaultItems: [PillarRubricItem] {
        [
            PillarRubricItem(id: "ri_marriage_quality_light", activityType: "Quality Time", tier: "Light", points: 10, examples: "Morning coffee together"),
            PillarRubricItem(id: "ri_marriage_quality_significant", activityType: "Quality Time", tier: "Significant", points: 50, examples: "Date night"),
            PillarRubricItem(id: "ri_marriage_service_small", activityType: "Acts of Service", tier: "Small", points: 15, examples: "Handled an errand"),
            PillarRubricItem(id: "ri_marriage_service_major", activityType: "Acts of Service", tier: "Major", points: 45, examples: "Big project or gesture"),
            PillarRubricItem(id: "ri_marriage_gift_small", activityType: "Gifts", tier: "Small", points: 30, examples: "Flowers or favorite snack"),
            PillarRubricItem(id: "ri_marriage_gift_significant", activityType: "Gifts", tier: "Significant", points: 50, examples: "Planned surprise"),
            PillarRubricItem(id: "ri_marriage_words", activityType: "Words of Affirmation", tier: "Meaningful", points: 20, examples: "Handwritten note or meaningful text")
        ]
    }

    private static var physicalDefaultItems: [PillarRubricItem] {
        [
            PillarRubricItem(id: "ri_physical_cardio_light", activityType: "Cardio", tier: "Light", points: 20, examples: "Walk or easy bike ride"),
            PillarRubricItem(id: "ri_physical_cardio_moderate", activityType: "Cardio", tier: "Moderate", points: 40, examples: "Jog or swim"),
            PillarRubricItem(id: "ri_physical_cardio_intense", activityType: "Cardio", tier: "Intense", points: 60, examples: "HIIT or race training"),
            PillarRubricItem(id: "ri_physical_strength_light", activityType: "Strength", tier: "Light", points: 25, examples: "Quick bodyweight session"),
            PillarRubricItem(id: "ri_physical_strength_heavy", activityType: "Strength", tier: "Heavy", points: 50, examples: "Full gym session"),
            PillarRubricItem(id: "ri_physical_recovery", activityType: "Active Recovery", tier: "Standard", points: 15, examples: "Stretching or yoga")
        ]
    }
    
    static func == (lhs: Pillar, rhs: Pillar) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
