//
//  PrinciplesViewModel.swift
//  Pillars
//
//  ViewModel for managing principles with Firestore reads and writes.
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
    
    // MARK: - Create

    func createPrinciple(pillarId: String, title: String, description: String, priority: Int = 3) async throws {
        guard let user = Auth.auth().currentUser else { throw PrincipleError.notAuthenticated }

        isSaving = true
        defer { isSaving = false }

        let now = Timestamp(date: Date())
        let principleRef = db.collection("principles").document()
        let payload: [String: Any] = [
            "id": principleRef.documentID,
            "userId": user.uid,
            "pillarId": pillarId,
            "title": title,
            "description": description,
            "priority": priority,
            "isActive": true,
            "tags": [],
            "createdAt": now,
            "updatedAt": now
        ]

        try await principleRef.setData(payload)
        print("✅ [PrinciplesViewModel] Created principle '\(title)'")
    }

    // MARK: - Update

    func updatePrinciple(_ principle: Principle, title: String? = nil, description: String? = nil, priority: Int? = nil, isActive: Bool? = nil) async throws {
        guard Auth.auth().currentUser != nil else { throw PrincipleError.notAuthenticated }
        guard let principleId = principle.id else { throw PrincipleError.updateFailed }

        isSaving = true
        defer { isSaving = false }

        var body: [String: Any] = [:]
        if let title = title { body["title"] = title }
        if let description = description { body["description"] = description }
        if let priority = priority { body["priority"] = priority }
        if let isActive = isActive { body["isActive"] = isActive }
        body["updatedAt"] = Timestamp(date: Date())

        try await db.collection("principles").document(principleId).setData(body, merge: true)
        print("✅ [PrinciplesViewModel] Updated principle '\(principle.title)'")
    }

    // MARK: - Delete

    func deletePrinciple(_ principle: Principle) async throws {
        guard Auth.auth().currentUser != nil else { throw PrincipleError.notAuthenticated }
        guard let principleId = principle.id else { throw PrincipleError.deleteFailed }

        try await db.collection("principles").document(principleId).delete()
        print("✅ [PrinciplesViewModel] Deleted principle '\(principle.title)'")
    }
}

// MARK: - Error Types

enum PrincipleError: LocalizedError {
    case notAuthenticated
    case invalidURL
    case invalidResponse
    case updateFailed
    case deleteFailed
    case serverError(String)
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to perform this action"
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .updateFailed:
            return "Failed to update principle"
        case .deleteFailed:
            return "Failed to delete principle"
        case .serverError(let message):
            return "Server error: \(message)"
        }
    }
}

