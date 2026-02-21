//
//  Pillar.swift
//  Pillars
//
//  A major domain of life (e.g., Work, Relationship, Health)
//

import Foundation
import SwiftUI

struct Pillar: Identifiable, Codable, Hashable {
    let id: String
    let userId: String
    var name: String
    var description: String
    var color: String
    var icon: PillarIcon?
    var emoji: String?
    var isDefault: Bool
    var isArchived: Bool
    var settings: [String: String]?
    var stats: PillarStats
    let createdAt: Date
    var updatedAt: Date
    var metadata: [String: String]?
    
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
        case id, userId, name, description, color, icon, emoji
        case isDefault, isArchived, settings, stats
        case createdAt, updatedAt, metadata
    }
    
    init(id: String, userId: String, name: String, description: String = "", color: String = "#000000",
         icon: PillarIcon? = nil, emoji: String? = nil, isDefault: Bool = false, isArchived: Bool = false,
         settings: [String: String]? = nil, stats: PillarStats = PillarStats(), createdAt: Date = Date(), updatedAt: Date = Date(),
         metadata: [String: String]? = nil) {
        self.id = id
        self.userId = userId
        self.name = name
        self.description = description
        self.color = color
        self.icon = icon
        self.emoji = emoji
        self.isDefault = isDefault
        self.isArchived = isArchived
        self.settings = settings
        self.stats = stats
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.metadata = metadata
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        userId = try container.decode(String.self, forKey: .userId)
        name = try container.decode(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        color = try container.decodeIfPresent(String.self, forKey: .color) ?? "#000000"
        emoji = try container.decodeIfPresent(String.self, forKey: .emoji)
        
        if let iconString = try container.decodeIfPresent(String.self, forKey: .icon) {
            icon = PillarIcon(rawValue: iconString)
        } else {
            icon = nil
        }
        
        isDefault = try container.decodeIfPresent(Bool.self, forKey: .isDefault) ?? false
        isArchived = try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
        settings = try container.decodeIfPresent([String: String].self, forKey: .settings)
        stats = try container.decodeIfPresent(PillarStats.self, forKey: .stats) ?? PillarStats()
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        metadata = try container.decodeIfPresent([String: String].self, forKey: .metadata)
    }
    
    var colorValue: Color {
        Color(hex: color)
    }
    
    static func == (lhs: Pillar, rhs: Pillar) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}



