//
//  OnboardingViewModel.swift
//  Pillars
//
//  ViewModel that manages onboarding content - fetches from Firestore with fallback to hardcoded.
//

import Foundation
import FirebaseFirestore

@MainActor
class OnboardingViewModel: ObservableObject {
    @Published var isLoading = true
    
    // Content loaded from API or fallback
    @Published private var apiContent: [OnboardingPillarContent] = []
    
    // Computed pillars for selection
    var pillars: [PillarOption] {
        if !apiContent.isEmpty {
            return apiContent.map { pillar in
                PillarOption(id: pillar.id, title: pillar.title, color: pillar.color)
            }
        }
        // Fallback to hardcoded
        return PillarOption.allPillars
    }
    
    init() {
        Task {
            await loadContent()
        }
    }
    
    func loadContent() async {
        isLoading = true
        
        do {
            let snapshot = try await Firestore.firestore().collection("onboardingPillars").getDocuments()
            let parsed = snapshot.documents.compactMap { parsePillar(from: $0.data(), id: $0.documentID) }
                .sorted { $0.order < $1.order }

            apiContent = parsed
            print("[Onboarding] Loaded \(apiContent.count) pillars from Firestore")
            for pillar in apiContent {
                print("[Onboarding]   - \(pillar.title) (id: \(pillar.id)): \(pillar.principles.count) principles")
            }
        } catch {
            print("[Onboarding] Failed to load from Firestore, using fallback: \(error.localizedDescription)")
            apiContent = []
        }
        
        isLoading = false
    }
    
    /// Get all principles for a pillar (from API or fallback)
    func allPrinciples(for pillarId: String) -> [String] {
        // Try API content first - principles are now directly on the pillar
        if let pillar = apiContent.first(where: { $0.id == pillarId }) {
            print("[Onboarding] allPrinciples for '\(pillarId)': found \(pillar.principles.count) principles from API")
            return pillar.principles
        }
        
        // Check if it's one of the API pillars by title
        if let pillar = apiContent.first(where: { $0.title.lowercased() == pillarId.lowercased() }) {
            print("[Onboarding] allPrinciples for '\(pillarId)' (by title): found \(pillar.principles.count) principles from API")
            return pillar.principles
        }
        
        // Fallback to hardcoded themes data (flatten principles from all themes)
        let themes = OnboardingTheme.themes(for: pillarId)
        let principles = themes.flatMap { $0.principles }
        print("[Onboarding] allPrinciples for '\(pillarId)': using fallback with \(themes.count) themes, \(principles.count) principles")
        return principles
    }
    
    /// Refresh content from API
    func refresh() async {
        await loadContent()
    }

    private func parsePillar(from raw: [String: Any], id: String) -> OnboardingPillarContent? {
        guard let title = raw["title"] as? String else { return nil }

        let principles = parsePrinciples(from: raw["principles"])

        return OnboardingPillarContent(
            id: (raw["id"] as? String) ?? id,
            title: title,
            description: raw["description"] as? String ?? "",
            icon: raw["icon"] as? String,
            color: raw["color"] as? String ?? "#007AFF",
            order: raw["order"] as? Int ?? 0,
            isActive: raw["isActive"] as? Bool ?? true,
            principles: principles
        )
    }

    private func parsePrinciples(from raw: Any?) -> [String] {
        if let values = raw as? [String] {
            return values
        }

        if let values = raw as? [[String: Any]] {
            return values.compactMap { item in
                if let title = item["title"] as? String, !title.isEmpty {
                    return title
                }
                if let content = item["content"] as? String, !content.isEmpty {
                    return content
                }
                return nil
            }
        }

        return []
    }
}
