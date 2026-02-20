//
//  PillarPickerDataSource.swift
//  Pillars
//
//  Lightweight shared pillar source for tag pickers in Day/Todo/Habits flows.
//

import Foundation
import FirebaseFirestore

@MainActor
final class PillarPickerDataSource: ObservableObject {
    @Published var pillars: [Pillar] = []

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?

    func startListening(userId: String) {
        listener?.remove()

        listener = db.collection("pillars")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                let docs = snapshot?.documents ?? []
                let mapped = docs.compactMap(Self.parsePillar(from:))
                    .filter { !$0.isArchived }
                    .sorted { $0.createdAt < $1.createdAt }
                self.pillars = mapped
            }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
        pillars = []
    }

    func pillar(for pillarId: String?) -> Pillar? {
        guard let pillarId else { return nil }
        return pillars.first(where: { $0.id == pillarId })
    }

    func pillarName(for pillarId: String?) -> String? {
        pillar(for: pillarId)?.name
    }

    private static func parsePillar(from doc: QueryDocumentSnapshot) -> Pillar? {
        let data = doc.data()

        guard let userId = data["userId"] as? String,
              let name = data["name"] as? String else {
            return nil
        }

        let createdAt = date(from: data["createdAt"]) ?? Date()
        let updatedAt = date(from: data["updatedAt"]) ?? createdAt

        let statsData = data["stats"] as? [String: Any] ?? [:]
        let stats = Pillar.PillarStats(
            conversationCount: statsData["conversationCount"] as? Int ?? 0,
            principleCount: statsData["principleCount"] as? Int ?? 0,
            wisdomCount: statsData["wisdomCount"] as? Int ?? 0,
            resourceCount: statsData["resourceCount"] as? Int ?? 0
        )

        return Pillar(
            id: doc.documentID,
            userId: userId,
            name: name,
            description: data["description"] as? String ?? "",
            color: data["color"] as? String ?? "#000000",
            icon: (data["icon"] as? String).flatMap(PillarIcon.init(rawValue:)),
            emoji: data["emoji"] as? String,
            isDefault: data["isDefault"] as? Bool ?? false,
            isArchived: data["isArchived"] as? Bool ?? false,
            settings: data["settings"] as? [String: String],
            stats: stats,
            createdAt: createdAt,
            updatedAt: updatedAt,
            metadata: data["metadata"] as? [String: String]
        )
    }

    private static func date(from raw: Any?) -> Date? {
        switch raw {
        case let timestamp as Timestamp:
            return timestamp.dateValue()
        case let value as TimeInterval:
            return Date(timeIntervalSince1970: value)
        case let value as Double:
            return Date(timeIntervalSince1970: value)
        case let value as Int:
            return Date(timeIntervalSince1970: Double(value))
        default:
            return nil
        }
    }
}
