//
//  OnboardingPrincipleSelectView.swift
//  Pillars
//
//  "Which of these best describes how you want to live that out?"
//

import SwiftUI

struct OnboardingPrincipleSelectView: View {
    let theme: OnboardingTheme
    @Binding var selectedPrinciple: String?
    let onContinue: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.xxl) {
            // Title
            Text("Which of these best describes how you want to live that out?")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(S2.Colors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            
            // Context - what they selected
            Text("For: \(theme.title)")
                .font(.system(size: 15))
                .foregroundColor(S2.Colors.secondaryText)
            
            // Selection options
            ScrollView(showsIndicators: false) {
                VStack(spacing: S2.Spacing.md) {
                    ForEach(theme.principles, id: \.self) { principle in
                        OnboardingSelectionRow(
                            title: principle,
                            isSelected: selectedPrinciple == principle
                        ) {
                            selectPrinciple(principle)
                        }
                    }
                }
                .padding(.bottom, S2.Spacing.xxxl)
            }
        }
    }
    
    private func selectPrinciple(_ principle: String) {
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedPrinciple = principle
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            onContinue()
        }
    }
}

#Preview {
    OnboardingPrincipleSelectView(
        theme: OnboardingTheme(
            title: "Knowing where my money goes",
            principles: [
                "Track every dollar, every week",
                "No mystery money—know before you spend",
                "Review my spending weekly without judgment"
            ]
        ),
        selectedPrinciple: .constant(nil)
    ) {
        print("Continue")
    }
    .padding(.horizontal, S2.Spacing.xl)
    .padding(.top, S2.Spacing.xxxl)
    .background(S2.Colors.primarySurface)
}


