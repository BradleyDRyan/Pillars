//
//  OnboardingContainerView.swift
//  Pillars
//
//  Single-step onboarding: choose multiple focus areas and create pillars.
//

import SwiftUI

struct OnboardingContainerView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @StateObject private var viewModel = OnboardingViewModel()

    @State private var selectedPillarIds: Set<String> = []
    @State private var isSubmitting = false
    @State private var submissionError: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: S2.Spacing.md) {
                OnboardingProgressBar(currentStep: 1, totalSteps: 1)
            }
            .padding(.horizontal, S2.Spacing.xl)
            .padding(.top, S2.Spacing.lg)

            if viewModel.isLoading {
                VStack(spacing: S2.Spacing.lg) {
                    Spacer()
                    ProgressView()
                        .scaleEffect(1.5)
                    Text("Loading template library...")
                        .font(.system(size: 15))
                        .foregroundColor(S2.Colors.secondaryText)
                    Spacer()
                }
                .padding(.horizontal, S2.Spacing.xl)
            } else {
                OnboardingFocusView(
                    pillars: viewModel.pillars,
                    selectedPillarIds: $selectedPillarIds,
                    isSubmitting: isSubmitting
                ) {
                    createSelectedPillars()
                }
                .padding(.horizontal, S2.Spacing.xl)
                .padding(.top, S2.Spacing.xxxl)
            }

            if let error = submissionError {
                Text(error)
                    .font(.system(size: 13))
                    .foregroundColor(.red)
                    .padding(.horizontal, S2.Spacing.xl)
                    .padding(.bottom, S2.Spacing.md)
            }

            if let warning = viewModel.errorMessage {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 12))
                        .foregroundColor(S2.Colors.secondaryText)
                    Text(warning)
                        .font(.system(size: 12))
                        .foregroundColor(S2.Colors.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, S2.Spacing.xl)
                .padding(.bottom, S2.Spacing.lg)
            }
        }
        .background(S2.Colors.primarySurface.ignoresSafeArea())
    }

    private func createSelectedPillars() {
        let selected = viewModel.selectedPillars(for: selectedPillarIds)
        guard !selected.isEmpty else { return }

        isSubmitting = true
        submissionError = nil

        Task {
            let selections = selected.map { option in
                FirebaseManager.OnboardingPillarSelection(
                    name: option.title,
                    pillarType: option.pillarType,
                    iconToken: option.iconToken,
                    colorToken: option.colorToken
                )
            }

            do {
                try await firebaseManager.completeOnboarding(selectedPillars: selections)
            } catch {
                submissionError = error.localizedDescription
            }

            isSubmitting = false
        }
    }
}

#Preview {
    OnboardingContainerView()
        .environmentObject(FirebaseManager.shared)
}
