//
//  Insight.swift
//  Pillars
//
//  User-captured experiences, lessons, and reflections within a Pillar
//

import Foundation
import FirebaseFirestore

struct Insight: Identifiable, Codable, Hashable {
    @DocumentID var id: String?
    let userId: String
    var pillarId: String?
    var content: String
    var source: InsightSource?
    var conversationId: String?
    var tags: [String]
    var createdAt: Date
    var updatedAt: Date
    
    init(
        id: String? = nil,
        userId: String,
        pillarId: String? = nil,
        content: String = "",
        source: InsightSource? = nil,
        conversationId: String? = nil,
        tags: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.pillarId = pillarId
        self.content = content
        self.source = source
        self.conversationId = conversationId
        self.tags = tags
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Source

enum InsightSource: String, Codable {
    case conversation
    case manual
    case reflection
}

// MARK: - Firestore

extension Insight {
    static let collectionName = "insights"
}




