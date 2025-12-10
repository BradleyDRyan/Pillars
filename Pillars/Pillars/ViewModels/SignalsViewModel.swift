import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class SignalsViewModel: ObservableObject {
    @Published var signals: [Signal] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isSaving = false

    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()
    private var activePersonId: String?

    func startListening(personId: String, userId: String) {
        if activePersonId == personId, listener != nil {
            return
        }

        stopListening()
        activePersonId = personId
        isLoading = true

        listener = db.collection("signals")
            .whereField("userId", isEqualTo: userId)
            .whereField("personId", isEqualTo: personId)
            .order(by: "occurredAt", descending: true)
            .limit(to: 100)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }

                Task { @MainActor in
                    if let error {
                        self.errorMessage = error.localizedDescription
                        self.isLoading = false
                        return
                    }

                    guard let documents = snapshot?.documents else {
                        self.signals = []
                        self.isLoading = false
                        self.errorMessage = nil
                        return
                    }

                    let mappedSignals: [Signal] = documents.compactMap { document in
                        let data = document.data()
                        guard
                            let type = data["type"] as? String,
                            let source = data["source"] as? String,
                            let description = data["description"] as? String,
                            let userId = data["userId"] as? String,
                            let personId = data["personId"] as? String,
                            let occurredAtTimestamp = data["occurredAt"] as? Timestamp
                        else {
                            return nil
                        }

                        let createdAt = (data["createdAt"] as? Timestamp)?.dateValue() ?? occurredAtTimestamp.dateValue()
                        let monitorId = data["monitorId"] as? String
                        let importanceValue = data["importance"] as? Int ?? {
                            if let doubleValue = data["importance"] as? Double {
                                return Int(doubleValue)
                            }
                            return 50
                        }()

                        return Signal(
                            id: document.documentID,
                            userId: userId,
                            personId: personId,
                            monitorId: monitorId,
                            type: type,
                            source: source,
                            description: description,
                            importance: importanceValue,
                            createdAt: createdAt,
                            occurredAt: occurredAtTimestamp.dateValue()
                        )
                    }

                    self.signals = mappedSignals
                    self.isLoading = false
                    self.errorMessage = nil
                }
            }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
        activePersonId = nil
    }

    func addSignal(
        person: Person,
        type: String,
        source: String,
        description: String,
        importance: Int = 50,
        occurredAt: Date
    ) async -> Bool {
        guard let user = Auth.auth().currentUser else {
            errorMessage = "Not authenticated"
            return false
        }

        let trimmedType = type.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedSource = source.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedType.isEmpty else {
            errorMessage = "Signal type is required"
            return false
        }

        guard !trimmedDescription.isEmpty else {
            errorMessage = "Signal description is required"
            return false
        }

        let document = db.collection("signals").document()
        let now = Date()
        let payload: [String: Any] = [
            "userId": user.uid,
            "personId": person.id,
            "monitorId": NSNull(),
            "type": trimmedType,
            "source": trimmedSource.isEmpty ? "manual" : trimmedSource,
            "description": trimmedDescription,
            "importance": max(0, min(importance, 100)),
            "createdAt": Timestamp(date: now),
            "occurredAt": Timestamp(date: occurredAt),
            "metadata": [
                "createdBy": "ios-app"
            ]
        ]

        isSaving = true
        defer { isSaving = false }

        do {
            try await document.setData(payload)
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    deinit {
        listener?.remove()
    }
}
