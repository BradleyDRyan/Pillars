//
//  ProjectsViewModel.swift
//  Squirrel2
//
//  ViewModel for managing projects with full CRUD operations
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class ProjectsViewModel: ObservableObject {
    @Published var projects: [Project] = []
    @Published var conversations: [Conversation] = []
    @Published var selectedProject: Project?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var projectsListener: ListenerRegistration?
    private var conversationsListener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    // MARK: - Listeners
    
    func startListening(userId: String) {
        startListeningToProjects(userId: userId)
    }
    
    func stopListening() {
        projectsListener?.remove()
        projectsListener = nil
        conversationsListener?.remove()
        conversationsListener = nil
    }
    
    private func startListeningToProjects(userId: String) {
        print("🔍 [ProjectsViewModel] Starting to listen for projects for userId: \(userId)")
        projectsListener?.remove()
        isLoading = true
        
        projectsListener = db.collection("projects")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [ProjectsViewModel] Error listening to projects: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("⚠️ [ProjectsViewModel] No project documents")
                    self.projects = []
                    self.isLoading = false
                    return
                }
                
                print("📊 [ProjectsViewModel] Found \(documents.count) project documents")
                
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
                        print("❌ [ProjectsViewModel] Missing required fields in project \(doc.documentID)")
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
                self.isLoading = false
                
                // Sync to shared container for Share Extension
                self.syncProjectsToSharedContainer(projects)
                
                print("✅ [ProjectsViewModel] Loaded \(self.projects.count) projects")
            }
    }
    
    // MARK: - Sync to Share Extension
    
    private static let appGroupId = "group.com.msldesign.sidekick"
    private static let recentProjectsKey = "share.recent.projects"
    
    private func syncProjectsToSharedContainer(_ projects: [Project]) {
        guard let defaults = UserDefaults(suiteName: Self.appGroupId) else { return }
        
        // Convert projects to simple dictionaries for the extension
        let projectDicts: [[String: String]] = projects.map { project in
            ["id": project.id, "name": project.name]
        }
        
        if let encoded = try? JSONEncoder().encode(projectDicts) {
            defaults.set(encoded, forKey: Self.recentProjectsKey)
            print("📤 [ProjectsViewModel] Synced \(projects.count) projects to share extension")
        }
    }
    
    // MARK: - Conversations for Project
    
    func startListeningToConversations(forProject projectId: String) {
        print("🔍 [ProjectsViewModel] Starting to listen for conversations in project: \(projectId)")
        conversationsListener?.remove()
        
        // Query by projectIds - order by updatedAt descending (most recent first)
        conversationsListener = db.collection("conversations")
            .whereField("projectIds", arrayContains: projectId)
            .order(by: "updatedAt", descending: true)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [ProjectsViewModel] Error listening to conversations: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("⚠️ [ProjectsViewModel] No conversation documents")
                    self.conversations = []
                    return
                }
                
                print("📊 [ProjectsViewModel] Found \(documents.count) conversations for project")
                
                var conversations = documents.compactMap { doc -> Conversation? in
                    let data = doc.data()
                    
                    let projectIds = data["projectIds"] as? [String] ?? []
                    
                    guard let userId = data["userId"] as? String,
                          let title = data["title"] as? String,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        print("❌ [ProjectsViewModel] Missing required fields in document \(doc.documentID)")
                        return nil
                    }
                    
                    let lastMessage = data["lastMessage"] as? String
                    
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
                
                // Already sorted by updatedAt descending via composite index
                self.conversations = conversations
                
                print("✅ [ProjectsViewModel] Loaded \(self.conversations.count) conversations for project")
            }
    }
    
    func stopListeningToConversations() {
        conversationsListener?.remove()
        conversationsListener = nil
        conversations = []
    }
    
    // MARK: - Create Project
    
    func createProject(name: String, description: String = "", color: String, icon: ProjectIcon?) async throws -> Project {
        guard let user = Auth.auth().currentUser else {
            throw ProjectError.notAuthenticated
        }
        
        let projectId = UUID().uuidString
        let now = Date()
        
        let projectData: [String: Any] = [
            "userId": user.uid,
            "name": name,
            "description": description,
            "color": color,
            "icon": icon?.rawValue as Any,
            "isDefault": false,
            "isArchived": false,
            "stats": [
                "conversationCount": 0,
                "taskCount": 0,
                "entryCount": 0,
                "thoughtCount": 0
            ],
            "createdAt": Timestamp(date: now),
            "updatedAt": Timestamp(date: now)
        ]
        
        try await db.collection("projects").document(projectId).setData(projectData)
        
        print("✅ [ProjectsViewModel] Created project '\(name)' with id: \(projectId)")
        
        return Project(
            id: projectId,
            userId: user.uid,
            name: name,
            description: description,
            color: color,
            icon: icon,
            isDefault: false,
            isArchived: false,
            stats: Project.ProjectStats(conversationCount: 0, taskCount: 0, entryCount: 0, thoughtCount: 0),
            createdAt: now,
            updatedAt: now
        )
    }
    
    // MARK: - Update Project
    
    func updateProject(_ project: Project, name: String? = nil, description: String? = nil, color: String? = nil, icon: ProjectIcon? = nil) async throws {
        var updateData: [String: Any] = [
            "updatedAt": FieldValue.serverTimestamp()
        ]
        
        if let name = name {
            updateData["name"] = name
        }
        if let description = description {
            updateData["description"] = description
        }
        if let color = color {
            updateData["color"] = color
        }
        if let icon = icon {
            updateData["icon"] = icon.rawValue
        }
        
        try await db.collection("projects").document(project.id).updateData(updateData)
        
        print("✅ [ProjectsViewModel] Updated project '\(project.name)'")
    }
    
    // MARK: - Delete Project (Archive)
    
    func deleteProject(_ project: Project) async throws {
        // Soft delete by archiving
        try await db.collection("projects").document(project.id).updateData([
            "isArchived": true,
            "updatedAt": FieldValue.serverTimestamp()
        ])
        
        print("✅ [ProjectsViewModel] Archived project '\(project.name)'")
    }
    
    // MARK: - Permanently Delete Project
    
    func permanentlyDeleteProject(_ project: Project) async throws {
        try await db.collection("projects").document(project.id).delete()
        
        print("✅ [ProjectsViewModel] Permanently deleted project '\(project.name)'")
    }
    
    // MARK: - Assign Conversation to Project
    
    func assignConversationToProject(conversation: Conversation, project: Project) async throws {
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
        
        print("✅ [ProjectsViewModel] Assigned conversation '\(conversation.title)' to project '\(project.name)'")
    }
    
    // MARK: - Remove Conversation from Project
    
    func removeConversationFromProject(conversation: Conversation, project: Project) async throws {
        var updatedProjectIds = conversation.projectIds
        updatedProjectIds.removeAll { $0 == project.id }
        
        try await db.collection("conversations")
            .document(conversation.id)
            .updateData([
                "projectIds": updatedProjectIds,
                "updatedAt": FieldValue.serverTimestamp()
            ])

        print("✅ [ProjectsViewModel] Removed conversation '\(conversation.title)' from project '\(project.name)'")
    }
}

// MARK: - Error Types

enum ProjectError: LocalizedError {
    case notAuthenticated
    case projectNotFound
    case updateFailed
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to perform this action"
        case .projectNotFound:
            return "Project not found"
        case .updateFailed:
            return "Failed to update project"
        }
    }
}
