import Foundation

@MainActor
final class PillarPointsViewModel: ObservableObject {
    @Published var events: [PointEvent] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let api = APIService.shared

    func load(pillarId: String, fromDate: String? = nil, toDate: String? = nil) async {
        isLoading = true
        errorMessage = nil
        do {
            print("🧪 [Points] Loading point events pillarId=\(pillarId) fromDate=\(fromDate ?? "nil") toDate=\(toDate ?? "nil")")
            let items = try await api.fetchPointEvents(pillarId: pillarId, fromDate: fromDate, toDate: toDate)
            events = items.sorted { lhs, rhs in
                if lhs.date != rhs.date {
                    return lhs.date > rhs.date
                }
                return (lhs.createdAt ?? 0) > (rhs.createdAt ?? 0)
            }
            let total = events.reduce(0) { partial, event in
                partial + event.points(for: pillarId)
            }
            let todoRefs = events
                .filter { $0.ref?.type == "todo" }
                .compactMap { $0.ref?.id }
            print("✅ [Points] Loaded \(events.count) events pillarId=\(pillarId) totalPoints=\(total) todoRefs=\(todoRefs)")
        } catch {
            print("❌ [Points] Failed to load point events pillarId=\(pillarId): \(error.localizedDescription)")
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func pointsForPillar(_ pillarId: String) -> Int {
        events.reduce(0) { partial, event in
            partial + event.points(for: pillarId)
        }
    }
}
