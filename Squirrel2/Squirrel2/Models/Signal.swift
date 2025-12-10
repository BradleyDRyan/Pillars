import Foundation

struct Signal: Identifiable, Codable, Equatable {
    let id: String
    let userId: String
    let personId: String
    let monitorId: String?
    var type: String
    var source: String
    var description: String
    var importance: Int
    let createdAt: Date
    var occurredAt: Date

    init(
        id: String = UUID().uuidString,
        userId: String,
        personId: String,
        monitorId: String? = nil,
        type: String,
        source: String,
        description: String,
        importance: Int = 50,
        createdAt: Date = Date(),
        occurredAt: Date
    ) {
        self.id = id
        self.userId = userId
        self.personId = personId
        self.monitorId = monitorId
        self.type = type
        self.source = source
        self.description = description
        self.importance = max(0, min(importance, 100))
        self.createdAt = createdAt
        self.occurredAt = occurredAt
    }
}
