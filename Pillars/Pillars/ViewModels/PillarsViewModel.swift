//
//  PillarsViewModel.swift
//  Pillars
//
//  ViewModel for managing pillars with Firestore
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
class PillarsViewModel: ObservableObject {
    @Published var pillars: [Pillar] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var pillarsListener: ListenerRegistration?
    private let db = Firestore.firestore()
    
    // MARK: - Listeners
    
    func startListening(userId: String) {
        print("🔍 [PillarsViewModel] Starting to listen for pillars for userId: \(userId)")
        pillarsListener?.remove()
        isLoading = true
        
        pillarsListener = db.collection("pillars")
            .whereField("userId", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                
                if let error = error {
                    print("❌ [PillarsViewModel] Error listening to pillars: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }
                
                guard let documents = snapshot?.documents else {
                    print("⚠️ [PillarsViewModel] No pillar documents")
                    self.pillars = []
                    self.isLoading = false
                    return
                }
                
                print("📊 [PillarsViewModel] Found \(documents.count) pillar documents")
                
                var pillars = documents.compactMap { doc -> Pillar? in
                    let data = doc.data()
                    
                    guard let userId = data["userId"] as? String,
                          let name = data["name"] as? String,
                          let createdTimestamp = data["createdAt"] as? Timestamp,
                          let updatedTimestamp = data["updatedAt"] as? Timestamp else {
                        print("❌ [PillarsViewModel] Missing required fields in pillar \(doc.documentID)")
                        return nil
                    }
                    
                    // Filter out archived pillars
                    let isArchived = data["isArchived"] as? Bool ?? false
                    if isArchived {
                        return nil
                    }
                    
                    let description = data["description"] as? String ?? ""
                    let color = data["color"] as? String ?? "#000000"
                    let isDefault = data["isDefault"] as? Bool ?? false
                    
                    // Parse icon
                    let iconString = data["icon"] as? String
                    let icon = PillarIcon.resolve(iconString)
                    
                    // Parse stats
                    let statsData = data["stats"] as? [String: Any] ?? [:]
                    let stats = Pillar.PillarStats(
                        conversationCount: statsData["conversationCount"] as? Int ?? 0,
                        principleCount: statsData["principleCount"] as? Int ?? 0,
                        wisdomCount: statsData["wisdomCount"] as? Int ?? 0,
                        resourceCount: statsData["resourceCount"] as? Int ?? 0,
                        pointEventCount: statsData["pointEventCount"] as? Int ?? 0,
                        pointTotal: statsData["pointTotal"] as? Int ?? 0
                    )
                    
                    return Pillar(
                        id: doc.documentID,
                        userId: userId,
                        name: name,
                        description: description,
                        color: color,
                        icon: icon,
                        emoji: data["emoji"] as? String,
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
                pillars.sort { $0.createdAt < $1.createdAt }
                self.pillars = pillars
                self.isLoading = false
                
                print("✅ [PillarsViewModel] Loaded \(self.pillars.count) pillars")
            }
    }
    
    func stopListening() {
        pillarsListener?.remove()
        pillarsListener = nil
    }
    
    // MARK: - Create Pillar
    
    func createPillar(name: String, description: String = "", color: String, icon: PillarIcon = .default) async throws -> Pillar {
        guard let user = Auth.auth().currentUser else {
            throw PillarError.notAuthenticated
        }
        
        let pillarId = UUID().uuidString
        let now = Date()
        
        var pillarData: [String: Any] = [
            "userId": user.uid,
            "name": name,
            "description": description,
            "color": color,
            "isDefault": false,
            "isArchived": false,
            "stats": [
                "conversationCount": 0,
                "principleCount": 0,
                "wisdomCount": 0,
                "resourceCount": 0,
                "pointEventCount": 0,
                "pointTotal": 0
            ],
            "createdAt": Timestamp(date: now),
            "updatedAt": Timestamp(date: now)
        ]
        
        pillarData["icon"] = icon.rawValue
        
        try await db.collection("pillars").document(pillarId).setData(pillarData)
        
        print("✅ [PillarsViewModel] Created pillar '\(name)' with id: \(pillarId)")
        
        return Pillar(
            id: pillarId,
            userId: user.uid,
            name: name,
            description: description,
            color: color,
            icon: icon,
            emoji: nil,
            stats: Pillar.PillarStats(),
            createdAt: now,
            updatedAt: now
        )
    }
    
    // MARK: - Update Pillar
    
    func updatePillar(_ pillar: Pillar, name: String? = nil, description: String? = nil, color: String? = nil, icon: PillarIcon? = nil) async throws {
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
        
        try await db.collection("pillars").document(pillar.id).updateData(updateData)
        
        print("✅ [PillarsViewModel] Updated pillar '\(pillar.name)'")
    }
    
    // MARK: - Delete Pillar (Archive)
    
    func deletePillar(_ pillar: Pillar) async throws {
        try await db.collection("pillars").document(pillar.id).updateData([
            "isArchived": true,
            "updatedAt": FieldValue.serverTimestamp()
        ])
        
        print("✅ [PillarsViewModel] Archived pillar '\(pillar.name)'")
    }
}

// MARK: - Error Types

enum PillarError: LocalizedError {
    case notAuthenticated
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to perform this action"
        }
    }
}
