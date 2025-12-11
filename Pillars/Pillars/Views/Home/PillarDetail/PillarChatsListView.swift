//
//  PillarChatsListView.swift
//  Pillars
//
//  List of past conversations linked to a specific pillar
//

import SwiftUI
import FirebaseFirestore
import FirebaseAuth

// MARK: - ViewModel

@MainActor
class PillarChatsViewModel: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var isLoading = true
    
    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    func startListening(userId: String, pillarId: String) {
        isLoading = true
        
        print("🔍 [PillarChatsViewModel] Starting listener for pillar: \(pillarId)")
        print("🔍 [PillarChatsViewModel] Query: conversations where userId=\(userId) AND pillarIds contains \(pillarId)")
        
        listener = db.collection("conversations")
            .whereField("userId", isEqualTo: userId)
            .whereField("pillarIds", arrayContains: pillarId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [PillarChatsViewModel] Error: \(error.localizedDescription)")
                    self.isLoading = false
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("📭 [PillarChatsViewModel] No documents returned for pillar: \(pillarId)")
                    self.conversations = []
                    self.isLoading = false
                    return
                }
                
                print("📬 [PillarChatsViewModel] Found \(documents.count) raw documents for pillar: \(pillarId)")
                
                self.conversations = documents.compactMap { doc in
                    let data = doc.data()
                    
                    guard let userId = data["userId"] as? String,
                          let title = data["title"] as? String,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        return nil
                    }
                    
                    let lastMessage = data["lastMessage"] as? String
                    
                    // Filter out empty conversations
                    if lastMessage == nil || lastMessage?.isEmpty == true {
                        return nil
                    }
                    
                    return Conversation(
                        id: doc.documentID,
                        userId: userId,
                        pillarIds: data["pillarIds"] as? [String] ?? [],
                        title: title,
                        lastMessage: lastMessage,
                        createdAt: createdTimestamp.dateValue(),
                        updatedAt: updatedTimestamp.dateValue(),
                        metadata: data["metadata"] as? [String: String]
                    )
                }
                
                // Sort by most recent
                self.conversations.sort { $0.updatedAt > $1.updatedAt }
                self.isLoading = false
                
                print("✅ [PillarChatsViewModel] Loaded \(self.conversations.count) conversations for pillar: \(pillarId)")
                for conv in self.conversations {
                    print("   📝 '\(conv.title)' (id: \(conv.id), pillarIds: \(conv.pillarIds))")
                }
            }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
}

// MARK: - Content View (no ScrollView - for embedding)

struct PillarChatsContentView: View {
    let pillar: Pillar
    
    @StateObject private var viewModel = PillarChatsViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var selectedConversation: Conversation?
    
    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 200)
            } else if viewModel.conversations.isEmpty {
                ContentEmptyState(
                    icon: "bubble.left.and.bubble.right",
                    title: "No Chats Yet",
                    description: "Conversations about this pillar will appear here"
                )
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(viewModel.conversations) { conversation in
                        PillarChatRow(conversation: conversation)
                            .onTapGesture {
                                selectedConversation = conversation
                            }
                    }
                }
                .padding(.horizontal, 20)
            }
        }
        .fullScreenCover(item: $selectedConversation) { conversation in
            NavigationStack {
                ConversationView(existingConversation: conversation)
                    .environmentObject(firebaseManager)
            }
        }
        .onAppear {
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId, pillarId: pillar.id)
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }
}

// MARK: - Standalone View (with ScrollView)

struct PillarChatsListView: View {
    let pillar: Pillar
    
    @StateObject private var viewModel = PillarChatsViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var selectedConversation: Conversation?
    
    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.conversations.isEmpty {
                ScrollView {
                    ContentEmptyState(
                        icon: "bubble.left.and.bubble.right",
                        title: "No Chats Yet",
                        description: "Conversations about this pillar will appear here"
                    )
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(viewModel.conversations) { conversation in
                            PillarChatRow(conversation: conversation)
                                .onTapGesture {
                                    selectedConversation = conversation
                                }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                }
            }
        }
        .fullScreenCover(item: $selectedConversation) { conversation in
            NavigationStack {
                ConversationView(existingConversation: conversation)
                    .environmentObject(firebaseManager)
            }
        }
        .onAppear {
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId, pillarId: pillar.id)
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }
}

// MARK: - Chat Row

struct PillarChatRow: View {
    let conversation: Conversation
    
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(conversation.title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                
                if let lastMessage = conversation.lastMessage, !lastMessage.isEmpty {
                    Text(lastMessage)
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
            
            Spacer()
            
            Text(timeAgo(conversation.updatedAt))
                .font(.system(size: 12))
                .foregroundColor(.secondary)
        }
        .padding(14)
        .background(Color(UIColor.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private func timeAgo(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

#Preview {
    PillarChatsListView(pillar: Pillar(
        id: "1",
        userId: "user1",
        name: "Career",
        color: "#868E96",
        icon: .briefcase
    ))
    .environmentObject(FirebaseManager.shared)
}
