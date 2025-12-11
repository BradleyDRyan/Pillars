//
//  OnboardingContainerView.swift
//  Pillars
//
//  Container view that manages the onboarding flow
//

import SwiftUI

enum OnboardingStep {
    case pillarSelect
    case themeSelect
    case principleSelect
}

struct OnboardingContainerView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @StateObject private var viewModel = OnboardingViewModel()
    
    @State private var currentStep: OnboardingStep = .pillarSelect
    @State private var selectedPillar: PillarOption?
    @State private var selectedTheme: OnboardingTheme?
    @State private var selectedPrinciple: String?
    @State private var lockedPrinciples: [String] = []
    @State private var usedThemeIds: Set<String> = []
    
    // Compute available themes (excluding used ones) - now using ViewModel
    private var availableThemes: [OnboardingTheme] {
        guard let pillar = selectedPillar else { return [] }
        return viewModel.themes(for: pillar.id).filter { !usedThemeIds.contains($0.id) }
    }
    
    // Dynamic progress based on principles locked
    private var progressStep: Int {
        // After pillar select, progress grows with each principle
        if currentStep == .pillarSelect {
            return 1
        }
        return min(2 + lockedPrinciples.count, 5) // Cap visual progress
    }
    
    private let totalSteps: Int = 5
    
    var body: some View {
        VStack(spacing: 0) {
            // Progress bar
            OnboardingProgressBar(currentStep: progressStep, totalSteps: totalSteps)
                .padding(.horizontal, S2.Spacing.xl)
                .padding(.top, S2.Spacing.lg)
            
            // Content
            Group {
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
                    switch currentStep {
                    case .pillarSelect:
                        OnboardingFocusView(
                            selectedPillar: $selectedPillar,
                            pillars: viewModel.pillars
                        ) {
                            advanceTo(.themeSelect)
                        }
                        .padding(.horizontal, S2.Spacing.xl)
                        .padding(.top, S2.Spacing.xxxl)
                        
                    case .themeSelect:
                        if let pillar = selectedPillar {
                            OnboardingThemeView(
                                pillar: pillar,
                                themes: availableThemes,
                                lockedPrinciples: lockedPrinciples,
                                selectedTheme: $selectedTheme,
                                onContinue: {
                                    advanceTo(.principleSelect)
                                },
                                onFinish: {
                                    completeOnboarding()
                                }
                            )
                            .padding(.horizontal, S2.Spacing.xl)
                            .padding(.top, S2.Spacing.xxl)
                        }
                        
                    case .principleSelect:
                        if let theme = selectedTheme {
                            OnboardingPrincipleSelectView(
                                theme: theme,
                                selectedPrinciple: $selectedPrinciple
                            ) {
                                lockPrincipleAndLoop()
                            }
                            .padding(.horizontal, S2.Spacing.xl)
                            .padding(.top, S2.Spacing.xxxl)
                        }
                    }
                }
            }
        }
        .background(S2.Colors.primarySurface.ignoresSafeArea())
    }
    
    private func advanceTo(_ step: OnboardingStep) {
        withAnimation(.easeInOut(duration: 0.3)) {
            currentStep = step
        }
    }
    
    private func lockPrincipleAndLoop() {
        // Lock the principle
        if let principle = selectedPrinciple {
            lockedPrinciples.append(principle)
        }
        
        // Mark theme as used
        if let theme = selectedTheme {
            usedThemeIds.insert(theme.id)
        }
        
        // Reset selections
        selectedTheme = nil
        selectedPrinciple = nil
        
        // Loop back to theme select (or complete if no themes left)
        if availableThemes.isEmpty {
            completeOnboarding()
        } else {
            advanceTo(.themeSelect)
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
