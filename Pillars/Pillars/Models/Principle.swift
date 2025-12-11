//
//  Principle.swift
//  Pillars
//
//  Guiding beliefs that define how the user wants to operate within a Pillar
//

import Foundation
import FirebaseFirestore

struct Principle: Identifiable, Codable, Hashable {
    @DocumentID var id: String?
    let userId: String
    var pillarId: String?
    var title: String
    var description: String
    var isActive: Bool
    var priority: Int // 1-5, higher = more important
    var tags: [String]
    var createdAt: Date
    var updatedAt: Date
    
    init(
        id: String? = nil,
        userId: String,
        pillarId: String? = nil,
        title: String = "",
        description: String = "",
        isActive: Bool = true,
        priority: Int = 3,
        tags: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.pillarId = pillarId
        self.title = title
        self.description = description
        self.isActive = isActive
        self.priority = priority
        self.tags = tags
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Firestore

extension Principle {
    static let collectionName = "principles"
}


