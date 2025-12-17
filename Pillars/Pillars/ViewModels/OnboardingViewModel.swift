//
//  OnboardingViewModel.swift
//  Pillars
//
//  ViewModel that manages onboarding content - fetches from API with fallback to hardcoded
//

import Foundation

@MainActor
class OnboardingViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var loadError: String?
    
    // Content loaded from API or fallback
    @Published private var apiContent: [OnboardingPillarContent] = []
    @Published var usingFallback = false
    
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
        loadError = nil
        
        do {
            let content = try await APIService.shared.fetchOnboardingContent()
            apiContent = content.content
            usingFallback = false
            print("[Onboarding] Loaded \(apiContent.count) pillars from API")
            for pillar in apiContent {
                print("[Onboarding]   - \(pillar.title) (id: \(pillar.id)): \(pillar.principles.count) principles")
            }
        } catch {
            print("[Onboarding] Failed to load from API, using fallback: \(error.localizedDescription)")
            apiContent = []
            usingFallback = true
            // Don't set loadError - we have a fallback
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
}
