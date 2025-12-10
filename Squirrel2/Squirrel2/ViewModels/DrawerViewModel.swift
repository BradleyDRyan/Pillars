//
//  DrawerViewModel.swift
//  Squirrel2
//
//  ViewModel for managing drawer data - projects and recent conversations
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class DrawerViewModel: ObservableObject {
    @Published var projects: [Project] = [] {
        didSet {
            // Re-filter conversations when projects change
            updateFilteredConversations()
        }
    }
    @Published var recentConversations: [Conversation] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var projectsListener: ListenerRegistration?
    private var conversationsListener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    // Store all conversations with messages for re-filtering when projects change
    private var allConversationsWithMessages: [Conversation] = []
    
    // MARK: - Start Listening
    
    func startListening(userId: String) {
        startListeningToProjects(userId: userId)
        startListeningToConversations(userId: userId)
    }
    
    func stopListening() {
        projectsListener?.remove()
        projectsListener = nil
        conversationsListener?.remove()
        conversationsListener = nil
    }
    
    // MARK: - Projects Listener
    
    private func startListeningToProjects(userId: String) {
        print("🔍 [DrawerViewModel] Starting to listen for projects for userId: \(userId)")
        projectsListener?.remove()
        
        // Note: Only use whereField for userId - filter isArchived in memory
        // This avoids needing composite indexes
        projectsListener = db.collection("projects")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [DrawerViewModel] Error listening to projects: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("⚠️ [DrawerViewModel] No project documents")
                    self.projects = []
                    return
                }
                
                print("📊 [DrawerViewModel] Found \(documents.count) project documents")
                
                // Parse manually to avoid decoder issues
                var projects = documents.compactMap { doc -> Project? in
                    let data = doc.data()
                    
                    guard let userId = data["userId"] as? String,
                          let name = data["name"] as? String,
                          let description = data["description"] as? String,
                          let color = data["color"] as? String,
                          let isDefault = data["isDefault"] as? Bool,
                          let isArchived = data["isArchived"] as? Bool,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        print("❌ [DrawerViewModel] Missing required fields in project \(doc.documentID)")
                        return nil
                    }
                    
                    // Filter out archived projects
                    if isArchived {
                        return nil
                    }
                    
                    // Parse icon string to ProjectIcon enum
                    let iconString = data["icon"] as? String
                    let icon = iconString.flatMap { ProjectIcon(rawValue: $0) }
                    
                    // Parse stats
                    let statsData = data["stats"] as? [String: Any] ?? [:]
                    let stats = Project.ProjectStats(
                        conversationCount: statsData["conversationCount"] as? Int ?? 0,
                        taskCount: statsData["taskCount"] as? Int ?? 0,
                        entryCount: statsData["entryCount"] as? Int ?? 0,
                        thoughtCount: statsData["thoughtCount"] as? Int ?? 0
                    )
                    
                    return Project(
                        id: doc.documentID,
                        userId: userId,
                        name: name,
                        description: description,
                        color: color,
                        icon: icon,
                        isDefault: isDefault,
                        isArchived: isArchived,
                        settings: data["settings"] as? [String: String],
                        stats: stats,
                        createdAt: createdTimestamp.dateValue(),
                        updatedAt: updatedTimestamp.dateValue(),
                        metadata: data["metadata"] as? [String: String]
                    )
                }
                
                // Sort by createdAt ascending
                projects.sort { $0.createdAt < $1.createdAt }
                self.projects = projects
                
                print("✅ [DrawerViewModel] Loaded \(self.projects.count) projects")
            }
    }
    
    // MARK: - Conversations Listener
    
    private func startListeningToConversations(userId: String) {
        print("🔍 [DrawerViewModel] Starting to listen for conversations for userId: \(userId)")
        conversationsListener?.remove()
        
        // Note: Don't use .order() here - it requires a composite index
        // Instead, we sort in memory after fetching
        conversationsListener = db.collection("conversations")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [DrawerViewModel] Error listening to conversations: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("⚠️ [DrawerViewModel] No conversation documents")
                    self.recentConversations = []
                    return
                }
                
                print("📊 [DrawerViewModel] Found \(documents.count) conversation documents")
                
                // Parse all conversations with messages (filter by project later)
                var conversations = documents.compactMap { doc -> Conversation? in
                    let data = doc.data()
                    
                    let projectIds = data["projectIds"] as? [String] ?? []
                    
                    guard let userId = data["userId"] as? String,
                          let title = data["title"] as? String,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        print("❌ [DrawerViewModel] Missing required fields in document \(doc.documentID)")
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
                        projectIds: projectIds,
                        title: title,
                        lastMessage: lastMessage,
                        createdAt: createdTimestamp.dateValue(),
                        updatedAt: updatedTimestamp.dateValue(),
                        metadata: data["metadata"] as? [String: String]
                    )
                }
                
                // Sort by updatedAt descending (most recent first)
                conversations.sort { $0.updatedAt > $1.updatedAt }
                self.allConversationsWithMessages = conversations
                
                // Apply project filter
                self.updateFilteredConversations()
                
                print("✅ [DrawerViewModel] Loaded \(self.recentConversations.count) recent conversations")
            }
    }
    
    // MARK: - Filter Conversations
    
    private func updateFilteredConversations() {
        // Get all user-created project IDs (from `projects` collection)
        let userProjectIds = Set(projects.map { $0.id })
        
        // Hide conversations that are assigned to any user-created project
        // Conversations with empty projectIds or only non-project IDs will show
        let filtered = allConversationsWithMessages.filter { conversation in
            let projectIdsInUserProjects = conversation.projectIds.filter { userProjectIds.contains($0) }
            return projectIdsInUserProjects.isEmpty
        }
        
        // Take top 10
        recentConversations = Array(filtered.prefix(10))
    }
    
    // MARK: - Assign Conversation to Project
    
    func assignConversationToProject(conversation: Conversation, project: Project) {
        Task {
            do {
                // Update the conversation's projectIds in Firestore
                var updatedProjectIds = conversation.projectIds
                if !updatedProjectIds.contains(project.id) {
                    updatedProjectIds.append(project.id)
                }
                
                try await db.collection("conversations")
                    .document(conversation.id)
                    .updateData([
                        "projectIds": updatedProjectIds,
                        "updatedAt": FieldValue.serverTimestamp()
                    ])
                
                print("✅ [DrawerViewModel] Assigned conversation '\(conversation.title)' to project '\(project.name)'")
                
            } catch {
                print("❌ [DrawerViewModel] Error assigning conversation to project: \(error.localizedDescription)")
                self.errorMessage = error.localizedDescription
            }
        }
    }
    
    func removeConversationFromProject(conversation: Conversation, project: Project) {
        Task {
            do {
                // Remove the project ID from the conversation's projectIds
                var updatedProjectIds = conversation.projectIds
                updatedProjectIds.removeAll { $0 == project.id }
                
                try await db.collection("conversations")
                    .document(conversation.id)
                    .updateData([
                        "projectIds": updatedProjectIds,
                        "updatedAt": FieldValue.serverTimestamp()
                    ])
                
                print("✅ [DrawerViewModel] Removed conversation '\(conversation.title)' from project '\(project.name)'")
                
            } catch {
                print("❌ [DrawerViewModel] Error removing conversation from project: \(error.localizedDescription)")
                self.errorMessage = error.localizedDescription
            }
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
                
                print("✅ [DrawerViewModel] Renamed conversation to '\(newTitle)'")
                
            } catch {
                print("❌ [DrawerViewModel] Error renaming conversation: \(error.localizedDescription)")
                self.errorMessage = error.localizedDescription
            }
        }
    }
    
    // MARK: - Delete Conversation
    
    func deleteConversation(_ conversation: Conversation) {
        Task {
            do {
                // Delete the conversation document
                try await db.collection("conversations")
                    .document(conversation.id)
                    .delete()
                
                print("✅ [DrawerViewModel] Deleted conversation '\(conversation.title)'")
                
            } catch {
                print("❌ [DrawerViewModel] Error deleting conversation: \(error.localizedDescription)")
                self.errorMessage = error.localizedDescription
            }
        }
    }
}

