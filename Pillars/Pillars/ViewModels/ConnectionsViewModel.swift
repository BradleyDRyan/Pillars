import SwiftUI
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class ConnectionsViewModel: ObservableObject {
    @Published var people: [Person] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isSaving = false

    static let maxPeople = 30

    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()
    private var currentUserId: String?

    func startListening(userId: String) {
        // Avoid resetting the listener if we're already listening for this user
        if currentUserId == userId, listener != nil {
            return
        }

        stopListening()

        currentUserId = userId
        isLoading = true

        listener = db.collection("people")
            .whereField("userId", isEqualTo: userId)
            .order(by: "createdAt", descending: false)
            .limit(to: Self.maxPeople)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }

                Task { @MainActor in
                    if let error = error {
                        self.errorMessage = error.localizedDescription
                        self.isLoading = false
                        return
                    }

                    guard let documents = snapshot?.documents else {
                        self.people = []
                        self.isLoading = false
                        self.errorMessage = nil
                        return
                    }

                    let fetchedPeople: [Person] = documents.compactMap { document in
                        let data = document.data()
                        guard
                            let name = data["name"] as? String,
                            let relationship = data["relationship"] as? String,
                            let userId = data["userId"] as? String
                        else {
                            return nil
                        }

                        let sharedInterests = data["sharedInterests"] as? [String] ?? []
                        let createdAt = (data["createdAt"] as? Timestamp)?.dateValue() ?? Date()
                        let updatedAt = (data["updatedAt"] as? Timestamp)?.dateValue() ?? createdAt

                        return Person(
                            id: document.documentID,
                            userId: userId,
                            name: name,
                            relationship: relationship,
                            sharedInterests: sharedInterests,
                            createdAt: createdAt,
                            updatedAt: updatedAt
                        )
                    }

                    self.people = fetchedPeople
                    self.isLoading = false
                    self.errorMessage = nil
                }
            }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
    }

    func addPerson(name: String, relationship: String, sharedInterests: [String]) async -> Bool {
        guard let user = Auth.auth().currentUser else {
            errorMessage = "Not authenticated"
            return false
        }

        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedRelationship = relationship.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedName.isEmpty else {
            errorMessage = "Name is required"
            return false
        }

        guard !trimmedRelationship.isEmpty else {
            errorMessage = "Relationship is required"
            return false
        }

        if people.count >= Self.maxPeople {
            errorMessage = "You can only add up to \(Self.maxPeople) people right now."
            return false
        }

        let cleanedInterests = sharedInterests
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        let document = db.collection("people").document()
        let now = Date()
        let payload: [String: Any] = [
            "userId": user.uid,
            "name": trimmedName,
            "relationship": trimmedRelationship,
            "sharedInterests": cleanedInterests,
            "createdAt": Timestamp(date: now),
            "updatedAt": Timestamp(date: now)
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
