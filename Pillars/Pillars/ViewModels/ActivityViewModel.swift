//
//  ActivityViewModel.swift
//  Squirrel2
//
//  ViewModel for managing activity/conversation history
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class ActivityViewModel: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()

    var groupedConversations: [String: [Conversation]] {
        Dictionary(grouping: conversations) { conversation in
            dateKey(from: conversation.updatedAt)
        }
    }

    func startListening(userId: String) {
        print("🔍 [ActivityViewModel] Starting to listen for conversations for userId: \(userId)")
        isLoading = true

        listener = db.collection("conversations")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else {
                    print("❌ [ActivityViewModel] Self is nil")
                    return
                }

                if let error = error {
                    print("❌ [ActivityViewModel] Error: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }

                guard let documents = snapshot?.documents else {
                    print("⚠️ [ActivityViewModel] No documents in snapshot")
                    self.conversations = []
                    self.isLoading = false
                    return
                }

                print("📊 [ActivityViewModel] Found \(documents.count) documents")

                self.conversations = documents.compactMap { doc in
                    let data = doc.data()

                    // Create Conversation manually from the document data
                    let projectIds = data["projectIds"] as? [String] ?? []
                    
                    guard let userId = data["userId"] as? String,
                          let title = data["title"] as? String,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        print("❌ [ActivityViewModel] Missing required fields in document \(doc.documentID)")
                        return nil
                    }

                    let lastMessage = data["lastMessage"] as? String

                    // Filter out conversations with no messages (no lastMessage means empty)
                    if lastMessage == nil || lastMessage?.isEmpty == true {
                        print("🔸 [ActivityViewModel] Filtering out empty conversation: \(title) (id: \(doc.documentID))")
                        return nil
                    }

                    let conversation = Conversation(
                        id: doc.documentID,
                        userId: userId,
                        projectIds: projectIds,
                        title: title,
                        lastMessage: lastMessage,
                        createdAt: createdTimestamp.dateValue(),
                        updatedAt: updatedTimestamp.dateValue(),
                        metadata: data["metadata"] as? [String: String]
                    )

                    print("✅ [ActivityViewModel] Parsed conversation: \(conversation.title) with id: \(conversation.id)")
                    return conversation
                }

                // Sort conversations by updatedAt descending (most recent first)
                self.conversations.sort { $0.updatedAt > $1.updatedAt }

                print("📋 [ActivityViewModel] Successfully loaded \(self.conversations.count) conversations")
                self.isLoading = false
            }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
    }

    private func dateKey(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    func dateFromKey(_ key: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: key) ?? Date()
    }
}