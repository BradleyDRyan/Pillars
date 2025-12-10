//
//  Project.swift
//  Squirrel2
//
//  Project model
//  Represents a user's project for organizing conversations
//

import Foundation
import SwiftUI

struct Project: Identifiable, Codable {
    let id: String
    let userId: String
    var name: String
    var description: String
    var color: String
    var icon: ProjectIcon?
    var isDefault: Bool
    var isArchived: Bool
    var settings: [String: String]?
    var stats: ProjectStats
    let createdAt: Date
    var updatedAt: Date
    var metadata: [String: String]?
    
    struct ProjectStats: Codable, Hashable {
        var conversationCount: Int
        var taskCount: Int
        var entryCount: Int
        var thoughtCount: Int
    }
    
    enum CodingKeys: String, CodingKey {
        case id, userId, name, description, color, icon
        case isDefault, isArchived, settings, stats
        case createdAt, updatedAt, metadata
    }
    
    // Memberwise initializer
    init(id: String, userId: String, name: String, description: String, color: String,
         icon: ProjectIcon? = nil, isDefault: Bool = false, isArchived: Bool = false,
         settings: [String: String]? = nil, stats: ProjectStats, createdAt: Date, updatedAt: Date,
         metadata: [String: String]? = nil) {
        self.id = id
        self.userId = userId
        self.name = name
        self.description = description
        self.color = color
        self.icon = icon
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
        description = try container.decode(String.self, forKey: .description)
        color = try container.decode(String.self, forKey: .color)
        
        // Decode icon from string rawValue
        if let iconString = try container.decodeIfPresent(String.self, forKey: .icon) {
            icon = ProjectIcon(rawValue: iconString)
        } else {
            icon = nil
        }
        
        isDefault = try container.decode(Bool.self, forKey: .isDefault)
        isArchived = try container.decode(Bool.self, forKey: .isArchived)
        stats = try container.decode(ProjectStats.self, forKey: .stats)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(userId, forKey: .userId)
        try container.encode(name, forKey: .name)
        try container.encode(description, forKey: .description)
        try container.encode(color, forKey: .color)
        
        // Encode icon as string rawValue
        try container.encodeIfPresent(icon?.rawValue, forKey: .icon)
        
        try container.encode(isDefault, forKey: .isDefault)
        try container.encode(isArchived, forKey: .isArchived)
        try container.encode(stats, forKey: .stats)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
    
    var colorValue: Color {
        Color(hex: color)
    }
}

extension Project: Hashable {
    static func == (lhs: Project, rhs: Project) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
