import Foundation
import FirebaseFirestore

struct CollectionEntrySuggestion: Identifiable {
    enum SuggestionType: String {
        case fetchProduct = "fetch_product_suggestion"
        case recipe = "recipe_suggestion"
        case unknown
    }

    enum Status: String {
        case pending
        case completed
        case failed
    }

    struct ProductSuggestion: Identifiable {
        let id = UUID()
        let merchant: String
        let title: String
        let price: String?
        let url: URL?
        let notes: String?
    }

    let id: String
    let collectionEntryId: String?
    let entryId: String?
    let collectionId: String?
    let userId: String
    let type: SuggestionType
    let status: Status
    let payload: [String: Any]
    let error: String?
    let metadata: [String: Any]?
    let createdAt: Date
    let updatedAt: Date

    init?(document: DocumentSnapshot) {
        guard let data = document.data(),
              let userId = data["userId"] as? String,
              let typeRaw = data["type"] as? String,
              let statusRaw = data["status"] as? String else {
            return nil
        }

        self.id = document.documentID
        self.collectionEntryId = data["collectionEntryId"] as? String
        self.entryId = data["entryId"] as? String
        self.collectionId = data["collectionId"] as? String
        self.userId = userId
        self.type = SuggestionType(rawValue: typeRaw) ?? .unknown
        self.status = Status(rawValue: statusRaw) ?? .pending
        self.payload = data["payload"] as? [String: Any] ?? [:]
        self.error = data["error"] as? String
        self.metadata = data["metadata"] as? [String: Any]

        if let createdTs = data["createdAt"] as? Timestamp {
            self.createdAt = createdTs.dateValue()
        } else {
            self.createdAt = Date()
        }

        if let updatedTs = data["updatedAt"] as? Timestamp {
            self.updatedAt = updatedTs.dateValue()
        } else {
            self.updatedAt = self.createdAt
        }
    }

    var productSuggestions: [ProductSuggestion] {
        guard type == .fetchProduct,
              let rawSuggestions = payload["suggestions"] as? [[String: Any]] else {
            return []
        }

        return rawSuggestions.compactMap { item in
            guard let title = item["title"] as? String else { return nil }
            let merchant = (item["merchant"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let merchantValue = merchant?.isEmpty == false ? merchant! : "Unknown retailer"
            let price = (item["price"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let notes = (item["notes"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)

            var url: URL? = nil
            if let urlString = item["url"] as? String,
               let candidate = URL(string: urlString),
               candidate.scheme?.hasPrefix("http") == true {
                url = candidate
            }

            return ProductSuggestion(
                merchant: merchantValue,
                title: title,
                price: price?.isEmpty == false ? price : nil,
                url: url,
                notes: notes?.isEmpty == false ? notes : nil
            )
        }
    }
}
