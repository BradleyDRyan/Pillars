//
//  PrinciplesViewModel.swift
//  Pillars
//
//  ViewModel for managing principles with Firestore reads and backend writes
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class PrinciplesViewModel: ObservableObject {
    @Published var principles: [Principle] = []
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published var isSaving = false
    
    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    // MARK: - Listeners (Reads from Firestore)
    
    func startListening(userId: String, pillarId: String) {
        isLoading = true
        listener?.remove()
        
        listener = db.collection("principles")
            .whereField("userId", isEqualTo: userId)
            .whereField("pillarId", isEqualTo: pillarId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [PrinciplesViewModel] Error: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    self.principles = []
                    self.isLoading = false
                    return
                }
                
                self.principles = documents.compactMap { doc -> Principle? in
                    let data = doc.data()
                    
                    guard let userId = data["userId"] as? String,
                          let title = data["title"] as? String else {
                        return nil
                    }
                    
                    let createdAt = (data["createdAt"] as? Timestamp)?.dateValue() ?? Date()
                    let updatedAt = (data["updatedAt"] as? Timestamp)?.dateValue() ?? Date()
                    
                    return Principle(
                        id: doc.documentID,
                        userId: userId,
                        pillarId: data["pillarId"] as? String,
                        title: title,
                        description: data["description"] as? String ?? "",
                        isActive: data["isActive"] as? Bool ?? true,
                        priority: data["priority"] as? Int ?? 3,
                        tags: data["tags"] as? [String] ?? [],
                        createdAt: createdAt,
                        updatedAt: updatedAt
                    )
                }
                
                // Sort by priority (high to low), then by creation date
                self.principles.sort { 
                    if $0.priority != $1.priority {
                        return $0.priority > $1.priority
                    }
                    return $0.createdAt < $1.createdAt
                }
                
                self.isLoading = false
                print("✅ [PrinciplesViewModel] Loaded \(self.principles.count) principles")
            }
    }
    
    func stopListening() {
        listener?.remove()
        listener = nil
    }
    
    // MARK: - Create (Writes to Backend)
    
    func createPrinciple(pillarId: String, title: String, description: String, priority: Int = 3) async throws {
        guard let user = Auth.auth().currentUser else {
            throw PrincipleError.notAuthenticated
        }
        
        isSaving = true
        defer { isSaving = false }
        
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/principles") else {
            throw PrincipleError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "pillarId": pillarId,
            "title": title,
            "description": description,
            "priority": priority,
            "isActive": true
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PrincipleError.invalidResponse
        }
        
        if httpResponse.statusCode != 201 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ [PrinciplesViewModel] Create failed: \(errorMessage)")
            throw PrincipleError.createFailed
        }
        
        print("✅ [PrinciplesViewModel] Created principle '\(title)'")
    }
    
    // MARK: - Update (Writes to Backend)
    
    func updatePrinciple(_ principle: Principle, title: String? = nil, description: String? = nil, priority: Int? = nil, isActive: Bool? = nil) async throws {
        guard let user = Auth.auth().currentUser,
              let principleId = principle.id else {
            throw PrincipleError.notAuthenticated
        }
        
        isSaving = true
        defer { isSaving = false }
        
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/principles/\(principleId)") else {
            throw PrincipleError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [:]
        if let title = title { body["title"] = title }
        if let description = description { body["description"] = description }
        if let priority = priority { body["priority"] = priority }
        if let isActive = isActive { body["isActive"] = isActive }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            print("❌ [PrinciplesViewModel] Update failed: \(errorMessage)")
            throw PrincipleError.updateFailed
        }
        
        print("✅ [PrinciplesViewModel] Updated principle '\(principle.title)'")
    }
    
    // MARK: - Delete (Writes to Backend)
    
    func deletePrinciple(_ principle: Principle) async throws {
        guard let user = Auth.auth().currentUser,
              let principleId = principle.id else {
            throw PrincipleError.notAuthenticated
        }
        
        let token = try await user.getIDToken()
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/principles/\(principleId)") else {
            throw PrincipleError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 204 else {
            throw PrincipleError.deleteFailed
        }
        
        print("✅ [PrinciplesViewModel] Deleted principle '\(principle.title)'")
    }
}

// MARK: - Error Types

enum PrincipleError: LocalizedError {
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
            return "Failed to create principle"
        case .updateFailed:
            return "Failed to update principle"
        case .deleteFailed:
            return "Failed to delete principle"
        }
    }
}
