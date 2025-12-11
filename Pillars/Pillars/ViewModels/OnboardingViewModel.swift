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
                PillarOption(id: pillar.id, title: pillar.title)
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
        } catch {
            print("[Onboarding] Failed to load from API, using fallback: \(error.localizedDescription)")
            apiContent = []
            usingFallback = true
            // Don't set loadError - we have a fallback
        }
        
        isLoading = false
    }
    
    /// Get themes for a pillar (either from API or fallback)
    func themes(for pillarId: String) -> [OnboardingTheme] {
        // Try API content first
        if let pillar = apiContent.first(where: { $0.id == pillarId }) {
            return pillar.themes.map { OnboardingTheme(from: $0) }
        }
        
        // Check if it's one of the API pillars by title
        if let pillar = apiContent.first(where: { $0.title.lowercased() == pillarId.lowercased() }) {
            return pillar.themes.map { OnboardingTheme(from: $0) }
        }
        
        // Fallback to hardcoded
        return OnboardingTheme.themes(for: pillarId)
    }
    
    /// Refresh content from API
    func refresh() async {
        await loadContent()
    }
}
