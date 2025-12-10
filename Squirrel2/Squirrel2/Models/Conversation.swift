import Foundation
import UniformTypeIdentifiers
import CoreTransferable

struct Conversation: Identifiable, Codable {
    let id: String
    let userId: String
    var projectIds: [String]
    var title: String
    var lastMessage: String?
    let createdAt: Date
    var updatedAt: Date
    var metadata: [String: String]?
    
    enum CodingKeys: String, CodingKey {
        case id, userId, projectIds, title, lastMessage
        case createdAt, updatedAt, metadata
    }
    
    init(id: String, userId: String, projectIds: [String], title: String, lastMessage: String? = nil, createdAt: Date, updatedAt: Date, metadata: [String: String]? = nil) {
        self.id = id
        self.userId = userId
        self.projectIds = projectIds
        self.title = title
        self.lastMessage = lastMessage
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.metadata = metadata
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        userId = try container.decode(String.self, forKey: .userId)
        projectIds = try container.decodeIfPresent([String].self, forKey: .projectIds) ?? []
        title = try container.decode(String.self, forKey: .title)
        lastMessage = try container.decodeIfPresent(String.self, forKey: .lastMessage)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(userId, forKey: .userId)
        try container.encode(projectIds, forKey: .projectIds)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(lastMessage, forKey: .lastMessage)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

extension Conversation: Hashable {
    static func == (lhs: Conversation, rhs: Conversation) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

// MARK: - Transferable (for drag and drop)
extension Conversation: Transferable {
    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .conversation)
    }
}

// Custom UTType for Conversation
extension UTType {
    static var conversation: UTType {
        UTType(exportedAs: "com.squirrel2.conversation")
    }
}
