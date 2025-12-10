import Foundation

struct Person: Identifiable, Codable, Equatable {
    let id: String
    let userId: String
    var name: String
    var relationship: String
    var sharedInterests: [String]
    let createdAt: Date
    var updatedAt: Date

    init(
        id: String = UUID().uuidString,
        userId: String,
        name: String,
        relationship: String,
        sharedInterests: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.relationship = relationship
        self.sharedInterests = sharedInterests
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
