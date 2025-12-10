//
//  HistoryViewModel.swift
//  Squirrel2
//
//  ViewModel for managing conversation history
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class HistoryViewModel: ObservableObject {
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
        print("🔍 [HistoryViewModel] Starting to listen for conversations for userId: \(userId)")
        isLoading = true
        
        // First try without ordering to see if we get data
        listener = db.collection("conversations")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { 
                    print("❌ [HistoryViewModel] Self is nil")
                    return 
                }
                
                if let error = error {
                    print("❌ [HistoryViewModel] Error: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("⚠️ [HistoryViewModel] No documents in snapshot")
                    self.conversations = []
                    self.isLoading = false
                    return
                }
                
                print("📊 [HistoryViewModel] Found \(documents.count) documents")
                
                self.conversations = documents.compactMap { doc in
                    let data = doc.data()

                    // Create Conversation manually from the document data
                    let pillarIds = data["pillarIds"] as? [String] ?? []
                    
                    guard let userId = data["userId"] as? String,
                          let title = data["title"] as? String,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        print("❌ [HistoryViewModel] Missing required fields in document \(doc.documentID)")
                        return nil
                    }

                    let lastMessage = data["lastMessage"] as? String

                    // Filter out conversations with no messages (no lastMessage means empty)
                    if lastMessage == nil || lastMessage?.isEmpty == true {
                        print("🔸 [HistoryViewModel] Filtering out empty conversation: \(title) (id: \(doc.documentID))")
                        return nil
                    }

                    let conversation = Conversation(
                        id: doc.documentID,
                        userId: userId,
                        pillarIds: pillarIds,
                        title: title,
                        lastMessage: lastMessage,
                        createdAt: createdTimestamp.dateValue(),
                        updatedAt: updatedTimestamp.dateValue(),
                        metadata: data["metadata"] as? [String: String]
                    )

                    print("✅ [HistoryViewModel] Parsed conversation: \(conversation.title) with id: \(conversation.id)")
                    return conversation
                }
                
                // Sort conversations by updatedAt descending (most recent first)
                self.conversations.sort { $0.updatedAt > $1.updatedAt }
                
                print("📋 [HistoryViewModel] Successfully loaded \(self.conversations.count) conversations")
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

@MainActor
class MessagesViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var isLoading = true
    @Published var errorMessage: String?
    
    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    func startListening(conversationId: String) {
        print("🔍 [MessagesViewModel] Starting to listen for messages in conversation: \(conversationId)")
        isLoading = true
        
        // Messages are now stored as a subcollection of conversations
        listener = db.collection("conversations").document(conversationId).collection("messages")
            .order(by: "createdAt")
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { 
                    print("❌ [MessagesViewModel] Self is nil")
                    return 
                }
                
                if let error = error {
                    print("❌ [MessagesViewModel] Error: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("⚠️ [MessagesViewModel] No documents in snapshot")
                    self.messages = []
                    self.isLoading = false
                    return
                }
                
                print("📊 [MessagesViewModel] Found \(documents.count) message documents")
                
                self.messages = documents.compactMap { doc in
                    let data = doc.data()
                    print("📝 [MessagesViewModel] Processing message document: \(doc.documentID)")
                    print("📄 [MessagesViewModel] Message data keys: \(data.keys.sorted())")
                    
                    // Create Message manually from the document data
                    guard let conversationId = data["conversationId"] as? String,
                          let userId = data["userId"] as? String,
                          let content = data["content"] as? String,
                          let typeString = data["type"] as? String,
                          let type = Message.MessageType(rawValue: typeString),
                          let createdTimestamp = data["createdAt"] as? Timestamp else {
                        print("❌ [MessagesViewModel] Missing required fields in message \(doc.documentID)")
                        print("   - conversationId: \(data["conversationId"] != nil)")
                        print("   - userId: \(data["userId"] != nil)")
                        print("   - content: \(data["content"] != nil)")
                        print("   - type: \(data["type"] as? String ?? "nil")")
                        print("   - createdAt: \(data["createdAt"] != nil)")
                        return nil
                    }
                    
                    // Handle attachments array (may be empty)
                    let attachments = data["attachments"] as? [String] ?? []
                    
                    // Parse role field - default to 'user' if missing for backwards compatibility
                    let roleString = data["role"] as? String ?? "user"
                    let role = MessageRole(rawValue: roleString) ?? .user
                    
                    // Create the message
                    let message = Message(
                        id: doc.documentID,
                        conversationId: conversationId,
                        userId: userId,
                        role: role,
                        content: content,
                        type: type,
                        attachments: attachments,
                        createdAt: createdTimestamp.dateValue(),
                        editedAt: (data["editedAt"] as? Timestamp)?.dateValue(),
                        metadata: data["metadata"] as? [String: String]
                    )
                    
                    print("✅ [MessagesViewModel] Parsed message: \(message.content.prefix(50))... from user: \(message.userId)")
                    return message
                }
                
                print("📋 [MessagesViewModel] Successfully loaded \(self.messages.count) messages")
                self.isLoading = false
            }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
}
