//
//  OnboardingViewModel.swift
//  Pillars
//
//  ViewModel for single-step onboarding template selection.
//

import Foundation

@MainActor
class OnboardingViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var pillars: [PillarOption] = []

    init() {
        Task {
            await loadTemplates()
        }
    }

    func loadTemplates() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let templates = try await APIService.shared.fetchPillarTemplates()
            let activeTemplates = templates
                .filter(\.isActive)
                .sorted { left, right in
                    if left.order != right.order {
                        return left.order < right.order
                    }
                    return left.name.localizedCaseInsensitiveCompare(right.name) == .orderedAscending
                }

            let mapped = activeTemplates.compactMap { template -> PillarOption? in
                let pillarType = template.pillarType
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .lowercased()
                guard !pillarType.isEmpty else { return nil }
                guard pillarType != "custom" else { return nil }

                let normalizedIconToken = PillarIconRegistry.normalizeToken(template.iconToken)
                let normalizedColorToken = PillarColorRegistry.normalizeToken(template.colorToken)
                    ?? PillarIconRegistry.defaultColorToken(for: normalizedIconToken)
                return PillarOption(
                    id: pillarType,
                    title: template.name,
                    description: template.description,
                    pillarType: pillarType,
                    iconToken: normalizedIconToken,
                    colorToken: normalizedColorToken
                )
            }

            let deduped = dedupeById(mapped)
            if deduped.isEmpty {
                pillars = PillarOption.fallbackTemplatePillars
                errorMessage = "No active templates found. Showing fallback options."
            } else {
                pillars = deduped
            }
        } catch {
            pillars = PillarOption.fallbackTemplatePillars
            errorMessage = "Could not load template library. Showing fallback options."
            print("[Onboarding] Failed to load pillar templates: \(error.localizedDescription)")
        }
    }

    func selectedPillars(for ids: Set<String>) -> [PillarOption] {
        pillars.filter { ids.contains($0.id) }
    }

    private func dedupeById(_ options: [PillarOption]) -> [PillarOption] {
        var seen = Set<String>()
        var deduped: [PillarOption] = []
        for option in options {
            if seen.contains(option.id) {
                continue
            }
            seen.insert(option.id)
            deduped.append(option)
        }
        return deduped
    }
}
