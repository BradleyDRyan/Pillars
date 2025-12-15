//
//  OnboardingProgressBar.swift
//  Pillars
//
//  Progress indicator for onboarding flow
//

import SwiftUI

struct OnboardingProgressBar: View {
    let currentStep: Int
    let totalSteps: Int
    
    private var progress: CGFloat {
        guard totalSteps > 0 else { return 0 }
        return CGFloat(currentStep) / CGFloat(totalSteps)
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background track
                Capsule()
                    .fill(S2.Colors.secondarySurface)
                    .frame(height: 4)
                
                // Progress fill with gradient
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(hex: "FF6B6B"),  // Warm red/pink
                                Color(hex: "FFB347")   // Warm orange
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geometry.size.width * progress, height: 4)
                    .animation(.easeInOut(duration: 0.3), value: progress)
            }
        }
        .frame(height: 4)
    }
}

#Preview {
    VStack(spacing: 32) {
        OnboardingProgressBar(currentStep: 1, totalSteps: 4)
        OnboardingProgressBar(currentStep: 2, totalSteps: 4)
        OnboardingProgressBar(currentStep: 3, totalSteps: 4)
        OnboardingProgressBar(currentStep: 4, totalSteps: 4)
    }
    .padding()
    .background(S2.Colors.primarySurface)
}


