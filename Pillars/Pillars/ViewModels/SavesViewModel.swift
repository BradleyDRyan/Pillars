//
//  SavesViewModel.swift
//  Pillars
//
//  ViewModel for managing saves (insights) with Firestore reads and backend writes
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class SavesViewModel: ObservableObject {
    @Published var saves: [Insight] = []
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published var isSaving = false
    
    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    // MARK: - Listeners (Reads from Firestore)
    
    func startListening(userId: String, pillarId: String) {
        isLoading = true
        listener?.remove()
        
        listener = db.collection("insights")
            .whereField("userId", isEqualTo: userId)
            .whereField("pillarId", isEqualTo: pillarId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [SavesViewModel] Error: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    self.saves = []
                    self.isLoading = false
                    return
                }
                
                self.saves = documents.compactMap { doc -> Insight? in
                    let data = doc.data()
                    
                    guard let userId = data["userId"] as? String,
                          let content = data["content"] as? String else {
                        return nil
                    }
                    
                    let createdAt = (data["createdAt"] as? Timestamp)?.dateValue() ?? Date()
                    let updatedAt = (data["updatedAt"] as? Timestamp)?.dateValue() ?? Date()
                    
                    // Parse source
                    var source: InsightSource? = nil
                    if let sourceString = data["source"] as? String {
                        source = InsightSource(rawValue: sourceString)
                    }
                    
                    return Insight(
                        id: doc.documentID,
                        userId: userId,
                        pillarId: data["pillarId"] as? String,
                        content: content,
                        source: source,
                        conversationId: data["conversationId"] as? String,
                        tags: data["tags"] as? [String] ?? [],
                        createdAt: createdAt,
                        updatedAt: updatedAt
                    )
                }
                
                // Sort by creation date (newest first)
                self.saves.sort { $0.createdAt > $1.createdAt }
                
                self.isLoading = false
                print("✅ [SavesViewModel] Loaded \(self.saves.count) saves")
            }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
    
    // MARK: - Create (Writes to Backend)
    
    func createSave(pillarId: String, content: String, source: InsightSource = .manual, tags: [String] = []) async throws {
        guard let user = Auth.auth().currentUser else {
            throw SaveError.notAuthenticated
        }
        
        isSaving = true
        defer { isSaving = false }
        
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/insights") else {
            throw SaveError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "pillarId": pillarId,
            "content": content,
            "source": source.rawValue,
            "tags": tags
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SaveError.invalidResponse
        }
        
        if httpResponse.statusCode != 201 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ [SavesViewModel] Create failed: \(errorMessage)")
            throw SaveError.createFailed
        }
        
        print("✅ [SavesViewModel] Created save")
    }
    
    // MARK: - Update (Writes to Backend)
    
    func updateSave(_ save: Insight, content: String? = nil, tags: [String]? = nil) async throws {
        guard let user = Auth.auth().currentUser,
              let saveId = save.id else {
            throw SaveError.notAuthenticated
        }
        
        isSaving = true
        defer { isSaving = false }
        
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/insights/\(saveId)") else {
            throw SaveError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [:]
        if let content = content { body["content"] = content }
        if let tags = tags { body["tags"] = tags }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ [SavesViewModel] Update failed: \(errorMessage)")
            throw SaveError.updateFailed
        }
        
        print("✅ [SavesViewModel] Updated save")
    }
    
    // MARK: - Delete (Writes to Backend)
    
    func deleteSave(_ save: Insight) async throws {
        guard let user = Auth.auth().currentUser,
              let saveId = save.id else {
            throw SaveError.notAuthenticated
        }
        
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/insights/\(saveId)") else {
            throw SaveError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 204 else {
            throw SaveError.deleteFailed
        }
        
        print("✅ [SavesViewModel] Deleted save")
    }
}

// MARK: - Error Types

enum SaveError: LocalizedError {
    case notAuthenticated
    case invalidURL
    case invalidResponse
    case createFailed
    case updateFailed
    case deleteFailed
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to perform this action"
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .createFailed:
            return "Failed to save"
        case .updateFailed:
            return "Failed to update"
        case .deleteFailed:
            return "Failed to delete"
        }
    }
}

