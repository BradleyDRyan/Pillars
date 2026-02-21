import Foundation

struct PointAllocation: Codable, Identifiable, Hashable {
    var id: String { pillarId }
    let pillarId: String
    let points: Int
}

struct PointEvent: Codable, Identifiable, Hashable {
    let id: String
    let userId: String
    let date: String
    let reason: String
    let source: String?
    let ref: Ref?
    let allocations: [PointAllocation]
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?
    let voidedAt: TimeInterval?

    struct Ref: Codable, Hashable {
        let type: String
        let id: String
    }

    /// Points allocated to a specific pillar
    func points(for pillarId: String) -> Int {
        allocations.first(where: { $0.pillarId == pillarId })?.points ?? 0
    }

    var dateValue: Date? {
        Self.dateFormatter.date(from: date)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
