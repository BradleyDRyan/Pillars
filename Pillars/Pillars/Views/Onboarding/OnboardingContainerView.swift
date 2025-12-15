//
//  OnboardingContainerView.swift
//  Pillars
//
//  Container view that manages the onboarding flow
//

import SwiftUI

enum OnboardingStep {
    case pillarSelect
    case principleSelect
    case reviewSaves
}

struct OnboardingContainerView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @StateObject private var viewModel = OnboardingViewModel()
    
    @State private var currentStep: OnboardingStep = .pillarSelect
    @State private var selectedPillar: PillarOption?
    @State private var selectedPrinciple: String?
    @State private var lockedPrinciples: [String] = []
    
    // Track the pillar that principles were selected for
    // If user goes back and selects the same pillar, keep the locked principles
    @State private var previousPillarId: String?
    
    // All principles for the current pillar (flattened from themes)
    private var availablePrinciples: [String] {
        guard let pillar = selectedPillar else { return [] }
        let allPrinciples = viewModel.allPrinciples(for: pillar.id)
        return allPrinciples.filter { !lockedPrinciples.contains($0) }
    }
    
    // Dynamic progress based on principles locked
    private var progressStep: Int {
        if currentStep == .pillarSelect {
            return 1
        }
        return min(2 + lockedPrinciples.count, 5) // Cap visual progress
    }
    
    private let totalSteps: Int = 5
    
    // Check if back navigation is available
    private var canGoBack: Bool {
        switch currentStep {
        case .pillarSelect:
            return false
        case .principleSelect:
            return true
        }
    }
    
    var body: some View {
        Group {
            switch currentStep {
            case .principleSelect:
                if let pillar = selectedPillar {
                    // Full-screen TikTok-style principle selector
                    ZStack(alignment: .topLeading) {
                        OnboardingPrincipleSelectView(
                            pillar: pillar,
                            availablePrinciples: availablePrinciples,
                            savedPrinciples: lockedPrinciples,
                            selectedPrinciple: $selectedPrinciple,
                            onSavePrinciple: {
                                lockPrinciple()
                            },
                            onReviewSaves: {
                                advanceTo(.reviewSaves)
                            }
                        )
                        .ignoresSafeArea()
                        
                        // Back button overlay
                        Button {
                            goBack()
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(12)
                                .background(
                                    Circle()
                                        .fill(Color.white.opacity(0.2))
                                )
                        }
                        .padding(.leading, 16)
                        .padding(.top, 8)
                    }
                }
                
            case .reviewSaves:
                if let pillar = selectedPillar {
                    OnboardingReviewView(
                        pillar: pillar,
                        savedPrinciples: $lockedPrinciples,
                        onAddMore: {
                            advanceTo(.principleSelect)
                        },
                        onConfirm: {
                            completeOnboarding()
                        }
                    )
                }
                
            case .pillarSelect:
                // Standard layout for pillar selection
                VStack(spacing: 0) {
                    // Header with back button and progress bar
                    HStack(spacing: S2.Spacing.md) {
                        // Back button
                        Button {
                            goBack()
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(canGoBack ? S2.Colors.primaryText : S2.Colors.tertiaryText)
                        }
                        .disabled(!canGoBack)
                        .opacity(canGoBack ? 1.0 : 0.3)
                        
                        // Progress bar
                        OnboardingProgressBar(currentStep: progressStep, totalSteps: totalSteps)
                    }
                    .padding(.horizontal, S2.Spacing.xl)
                    .padding(.top, S2.Spacing.lg)
                    
                    // Content
                    if viewModel.isLoading {
                        // Loading state
                        VStack(spacing: S2.Spacing.lg) {
                            Spacer()
                            ProgressView()
                                .scaleEffect(1.5)
                            Text("Loading...")
                                .font(.system(size: 15))
                                .foregroundColor(S2.Colors.secondaryText)
                            Spacer()
                        }
                        .padding(.horizontal, S2.Spacing.xl)
                    } else {
                        OnboardingFocusView(
                            selectedPillar: $selectedPillar,
                            pillars: viewModel.pillars
                        ) {
                            handlePillarSelected()
                        }
                        .padding(.horizontal, S2.Spacing.xl)
                        .padding(.top, S2.Spacing.xxxl)
                    }
                }
                .background(S2.Colors.primarySurface.ignoresSafeArea())
            }
        }
    }
    
    private func handlePillarSelected() {
        guard let pillar = selectedPillar else { return }
        
        // Check if this is a different pillar than before
        if previousPillarId != pillar.id {
            // Different pillar - clear locked principles
            lockedPrinciples = []
        }
        // If same pillar, keep the locked principles
        
        previousPillarId = pillar.id
        advanceTo(.principleSelect)
    }
    
    private func goBack() {
        withAnimation(.easeInOut(duration: 0.3)) {
            switch currentStep {
            case .pillarSelect:
                // Already at beginning, do nothing
                break
                
            case .principleSelect:
                // If we have locked principles, unlock the last one
                if !lockedPrinciples.isEmpty {
                    lockedPrinciples.removeLast()
                } else {
                    // No locked principles - go back to pillar select
                    selectedPrinciple = nil
                    currentStep = .pillarSelect
                }
            }
        }
    }
    
    private func advanceTo(_ step: OnboardingStep) {
        withAnimation(.easeInOut(duration: 0.3)) {
            currentStep = step
        }
    }
    
    private func lockPrinciple() {
        guard let principle = selectedPrinciple else { return }
        
        withAnimation(.easeInOut(duration: 0.3)) {
            lockedPrinciples.append(principle)
            selectedPrinciple = nil
        }
        
        // Auto-complete if no more principles available
        if availablePrinciples.isEmpty {
            completeOnboarding()
        }
    }
    
    private func completeOnboarding() {
        guard let pillar = selectedPillar else { return }
        
        Task {
            await firebaseManager.completeOnboarding(
                selectedPillar: pillar.title,
                principles: lockedPrinciples
            )
        }
    }
}

#Preview {
    OnboardingContainerView()
        .environmentObject(FirebaseManager.shared)
}
