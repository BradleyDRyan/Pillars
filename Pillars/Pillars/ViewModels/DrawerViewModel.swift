//
//  DrawerViewModel.swift
//  Pillars
//
//  ViewModel for managing drawer data - recent conversations
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class DrawerViewModel: ObservableObject {
    @Published var recentConversations: [Conversation] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var conversationsListener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    // MARK: - Start Listening
    
    func startListening(userId: String) {
        startListeningToConversations(userId: userId)
    }
    
    func stopListening() {
        conversationsListener?.remove()
        conversationsListener = nil
    }
    
    // MARK: - Conversations Listener
    
    private func startListeningToConversations(userId: String) {
        conversationsListener?.remove()
        
        conversationsListener = db.collection("conversations")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    self.errorMessage = error.localizedDescription
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    self.recentConversations = []
                    return
                }
                
                var conversations = documents.compactMap { doc -> Conversation? in
                    let data = doc.data()
                    
                    let pillarIds = data["pillarIds"] as? [String] ?? []
                    
                    guard let userId = data["userId"] as? String,
                          let title = data["title"] as? String,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        return nil
                    }
                    
                    let lastMessage = data["lastMessage"] as? String
                    
                    // Filter out conversations with no messages
                    if lastMessage == nil || lastMessage?.isEmpty == true {
                        return nil
                    }
                    
                    return Conversation(
                        id: doc.documentID,
                        userId: userId,
                        pillarIds: pillarIds,
                        title: title,
                        lastMessage: lastMessage,
                        createdAt: createdTimestamp.dateValue(),
                        updatedAt: updatedTimestamp.dateValue(),
                        metadata: data["metadata"] as? [String: String]
                    )
                }
                
                // Sort by updatedAt descending (most recent first)
                conversations.sort { $0.updatedAt > $1.updatedAt }
                
                // Take top 10
                self.recentConversations = Array(conversations.prefix(10))
            }
    }
    
    // MARK: - Rename Conversation
    
    func renameConversation(_ conversation: Conversation, newTitle: String) {
        Task {
            do {
                try await db.collection("conversations")
                    .document(conversation.id)
                    .updateData([
                        "title": newTitle,
                        "updatedAt": FieldValue.serverTimestamp()
                    ])
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }
    
    // MARK: - Delete Conversation
    
    func deleteConversation(_ conversation: Conversation) {
        Task {
            do {
                try await db.collection("conversations")
                    .document(conversation.id)
                    .delete()
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }
}
