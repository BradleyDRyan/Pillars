import Foundation

enum MessageRole: String, Codable {
    case user = "user"
    case assistant = "assistant"
    case system = "system"
}

struct Message: Identifiable, Codable {
    let id: String
    let conversationId: String
    let userId: String
    let role: MessageRole
    var content: String
    var type: MessageType
    var attachments: [String]
    let createdAt: Date
    var editedAt: Date?
    var metadata: [String: String]?
    
    // Additional properties for voice/chat features
    var source: MessageSource = .text
    var voiceTranscript: String?
    
    // Computed property for timestamp (alias for createdAt)
    var timestamp: Date {
        return createdAt
    }
    
    enum MessageType: String, Codable {
        case text = "text"
        case image = "image"
        case voice = "voice"
        case system = "system"
    }
    
    // Source of the message (text input, voice, etc.)
    enum MessageSource: String, Codable {
        case text = "text"
        case voice = "voice"
        case camera = "camera"
    }
    
    // Manual initializer for creating from Firestore data
    init(id: String = UUID().uuidString, 
         conversationId: String, 
         userId: String, 
         role: MessageRole, 
         content: String, 
         type: MessageType = .text, 
         attachments: [String] = [], 
         createdAt: Date = Date(), 
         editedAt: Date? = nil, 
         metadata: [String: String]? = nil,
         source: MessageSource = .text,
         voiceTranscript: String? = nil) {
        self.id = id
        self.conversationId = conversationId
        self.userId = userId
        self.role = role
        self.content = content
        self.type = type
        self.attachments = attachments
        self.createdAt = createdAt
        self.editedAt = editedAt
        self.metadata = metadata
        self.source = source
        self.voiceTranscript = voiceTranscript
    }
    
    enum CodingKeys: String, CodingKey {
        case id, conversationId, userId, role, content, type
        case attachments, createdAt, editedAt, metadata
        case source, voiceTranscript
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        conversationId = try container.decode(String.self, forKey: .conversationId)
        userId = try container.decode(String.self, forKey: .userId)
        role = try container.decodeIfPresent(MessageRole.self, forKey: .role) ?? .user
        content = try container.decode(String.self, forKey: .content)
        type = try container.decode(MessageType.self, forKey: .type)
        attachments = try container.decodeIfPresent([String].self, forKey: .attachments) ?? []
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        editedAt = try container.decodeIfPresent(Date.self, forKey: .editedAt)
        metadata = try container.decodeIfPresent([String: String].self, forKey: .metadata)
        
        // Parse source from metadata if available
        if let sourceString = metadata?["source"], 
           let messageSource = MessageSource(rawValue: sourceString) {
            source = messageSource
        } else {
            source = .text
        }
        
        voiceTranscript = try container.decodeIfPresent(String.self, forKey: .voiceTranscript)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(conversationId, forKey: .conversationId)
        try container.encode(userId, forKey: .userId)
        try container.encode(role, forKey: .role)
        try container.encode(content, forKey: .content)
        try container.encode(type, forKey: .type)
        try container.encode(attachments, forKey: .attachments)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(editedAt, forKey: .editedAt)
        try container.encodeIfPresent(metadata, forKey: .metadata)
        try container.encode(source, forKey: .source)
        try container.encodeIfPresent(voiceTranscript, forKey: .voiceTranscript)
    }
}

extension Message: Hashable {
    static func == (lhs: Message, rhs: Message) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
