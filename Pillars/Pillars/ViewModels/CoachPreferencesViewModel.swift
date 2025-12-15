//
//  CoachPreferencesViewModel.swift
//  Pillars
//
//  ViewModel for managing coach preferences
//

import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
class CoachPreferencesViewModel: ObservableObject {
    @Published var preferences: CoachPreferences = .default
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    
    private let db = Firestore.firestore()
    
    init() {
        Task {
            await load()
        }
    }
    
    // MARK: - Load Preferences
    func load() async {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        
        isLoading = true
        
        do {
            let document = try await db.collection("coachPreferences").document(userId).getDocument()
            
            if document.exists, let data = document.data() {
                preferences = try parsePreferences(from: data)
            } else {
                // Use defaults if no preferences saved yet
                preferences = .default
            }
        } catch {
            print("❌ [CoachPreferencesViewModel] Error loading: \(error)")
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Save Preferences
    func save() async {
        guard let user = Auth.auth().currentUser else { return }
        
        isSaving = true
        
        do {
            let token = try await user.getIDToken()
            guard let url = URL(string: "\(AppConfig.apiBaseURL)/coach-preferences") else {
                throw URLError(.badURL)
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body: [String: Any] = [
                "communicationStyle": preferences.communicationStyle.rawValue,
                "tone": preferences.tone.rawValue,
                "checkInFrequency": preferences.checkInFrequency.rawValue,
                "preferredTime": preferences.preferredTime.rawValue,
                "focusAreas": preferences.focusAreas.map { $0.rawValue },
                "useEmojis": preferences.useEmojis,
                "messageLength": preferences.messageLength.rawValue,
                "proactiveCheckIns": preferences.proactiveCheckIns
            ]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            
            print("✅ [CoachPreferencesViewModel] Preferences saved")
            
        } catch {
            print("❌ [CoachPreferencesViewModel] Error saving: \(error)")
            errorMessage = error.localizedDescription
        }
        
        isSaving = false
    }
    
    // MARK: - Parse Preferences
    private func parsePreferences(from data: [String: Any]) throws -> CoachPreferences {
        let communicationStyleString = data["communicationStyle"] as? String ?? "Balanced"
        let toneString = data["tone"] as? String ?? "Supportive"
        let checkInFrequencyString = data["checkInFrequency"] as? String ?? "When I reach out"
        let preferredTimeString = data["preferredTime"] as? String ?? "Anytime"
        let focusAreasStrings = data["focusAreas"] as? [String] ?? ["Goals", "Habits"]
        let useEmojis = data["useEmojis"] as? Bool ?? true
        let messageLengthString = data["messageLength"] as? String ?? "Concise"
        let proactiveCheckIns = data["proactiveCheckIns"] as? Bool ?? false
        
        return CoachPreferences(
            id: data["id"] as? String,
            userId: data["userId"] as? String,
            communicationStyle: CommunicationStyle(rawValue: communicationStyleString) ?? .balanced,
            tone: CoachingTone(rawValue: toneString) ?? .supportive,
            checkInFrequency: CheckInFrequency(rawValue: checkInFrequencyString) ?? .whenIReachOut,
            preferredTime: PreferredTime(rawValue: preferredTimeString) ?? .anytime,
            focusAreas: focusAreasStrings.compactMap { FocusArea(rawValue: $0) },
            useEmojis: useEmojis,
            messageLength: MessageLength(rawValue: messageLengthString) ?? .concise,
            proactiveCheckIns: proactiveCheckIns,
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue(),
            updatedAt: (data["updatedAt"] as? Timestamp)?.dateValue()
        )
    }
}


