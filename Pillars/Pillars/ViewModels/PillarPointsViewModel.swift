import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class PillarPointsViewModel: ObservableObject {
    @Published var events: [PointEvent] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load(pillarId: String, fromDate: String? = nil, toDate: String? = nil) async {
        isLoading = true
        errorMessage = nil
        do {
            print("🧪 [Points] Mode=firestore_direct apiBypass=true")
            print("🧪 [Points] Loading point events pillarId=\(pillarId) fromDate=\(fromDate ?? "nil") toDate=\(toDate ?? "nil")")

            guard let userId = Auth.auth().currentUser?.uid else {
                throw BackendError.notAuthenticated
            }

            let snapshot = try await Firestore.firestore()
                .collection("pointEvents")
                .whereField("userId", isEqualTo: userId)
                .getDocuments()

            print("🧪 [Points] Firestore fetched docs=\(snapshot.documents.count) userId=\(userId)")

            let parsed = snapshot.documents.compactMap(pointEvent(from:))
            let filtered = parsed
                .filter { $0.voidedAt == nil }
                .filter { fromDate == nil || $0.date >= (fromDate ?? "") }
                .filter { toDate == nil || $0.date <= (toDate ?? "") }
                .filter { event in event.allocations.contains(where: { $0.pillarId == pillarId }) }

            events = filtered.sorted { lhs, rhs in
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
            let nsError = error as NSError
            print(
                "❌ [Points] Failed to load point events pillarId=\(pillarId): \(error.localizedDescription) "
                + "domain=\(nsError.domain) code=\(nsError.code)"
            )
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func pointsForPillar(_ pillarId: String) -> Int {
        events.reduce(0) { partial, event in
            partial + event.points(for: pillarId)
        }
    }

    private func pointEvent(from document: QueryDocumentSnapshot) -> PointEvent? {
        let data = document.data()
        guard let userId = data["userId"] as? String,
              let date = data["date"] as? String else {
            return nil
        }

        let ref: PointEvent.Ref? = {
            guard let raw = data["ref"] as? [String: Any] else { return nil }
            guard let type = raw["type"] as? String,
                  let id = raw["id"] as? String else { return nil }
            return PointEvent.Ref(type: type, id: id)
        }()

        let reasonRaw = (data["reason"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let defaultReason = ref?.type == "todo" ? "Todo" : "Points"
        let reason = (reasonRaw?.isEmpty == false) ? (reasonRaw ?? defaultReason) : defaultReason

        let allocations: [PointAllocation] = ((data["allocations"] as? [[String: Any]]) ?? []).compactMap { raw in
            guard let pillarId = raw["pillarId"] as? String,
                  let points = intValue(raw["points"]) else {
                return nil
            }
            return PointAllocation(pillarId: pillarId, points: points)
        }

        guard !allocations.isEmpty else { return nil }

        return PointEvent(
            id: document.documentID,
            userId: userId,
            date: date,
            reason: reason,
            source: data["source"] as? String,
            ref: ref,
            allocations: allocations,
            createdAt: timestampValue(data["createdAt"]),
            updatedAt: timestampValue(data["updatedAt"]),
            voidedAt: timestampValue(data["voidedAt"])
        )
    }

    private func intValue(_ raw: Any?) -> Int? {
        switch raw {
        case let value as Int:
            return value
        case let value as Int64:
            return Int(value)
        case let value as Double:
            return Int(value.rounded(.towardZero))
        case let value as NSNumber:
            return value.intValue
        default:
            return nil
        }
    }

    private func timestampValue(_ raw: Any?) -> TimeInterval? {
        switch raw {
        case let value as NSNumber:
            return value.doubleValue
        case let value as Double:
            return value
        case let value as Int:
            return TimeInterval(value)
        case let value as Int64:
            return TimeInterval(value)
        case let value as Timestamp:
            return value.dateValue().timeIntervalSince1970
        default:
            return nil
        }
    }
}
