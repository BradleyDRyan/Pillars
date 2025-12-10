import Foundation
import FirebaseFirestore

@MainActor
class CollectionEntryDetailViewModel: ObservableObject {
    @Published var suggestions: [CollectionEntrySuggestion] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private let entryId: String
    private let collectionEntryId: String?
    private var userId: String?
    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()

    init(entryId: String, collectionEntryId: String?) {
        self.entryId = entryId
        self.collectionEntryId = collectionEntryId
    }

    deinit {
        listener?.remove()
        listener = nil
    }

    func startListening(userId: String) {
        guard listener == nil || self.userId != userId else { return }

        stopListening()
        self.userId = userId
        isLoading = true

        var query: Query = db.collection("collection_entry_suggestions")
            .whereField("userId", isEqualTo: userId)

        if let collectionEntryId = collectionEntryId {
            query = query.whereField("collectionEntryId", isEqualTo: collectionEntryId)
        } else {
            query = query.whereField("entryId", isEqualTo: entryId)
        }

        listener = query.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self else { return }

            if let error = error {
                Task { @MainActor in
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
                return
            }

            guard let documents = snapshot?.documents else {
                Task { @MainActor in
                    self.suggestions = []
                    self.isLoading = false
                }
                return
            }

            let parsed = documents.compactMap { CollectionEntrySuggestion(document: $0) }
                .sorted { $0.updatedAt > $1.updatedAt }

            Task { @MainActor in
                self.suggestions = parsed
                self.isLoading = false
                self.errorMessage = nil
            }
        }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
    }
}
