//
//  OnboardingSelectionRow.swift
//  Pillars
//
//  A selectable row for onboarding questions
//

import SwiftUI

struct OnboardingSelectionRow: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundColor(S2.Colors.primaryText)
                
                Spacer()
                
                // Selection indicator
                ZStack {
                    Circle()
                        .stroke(isSelected ? Color.clear : S2.Colors.tertiaryText, lineWidth: 1.5)
                        .frame(width: 24, height: 24)
                    
                    if isSelected {
                        Circle()
                            .fill(S2.Colors.primaryText)
                            .frame(width: 24, height: 24)
                        
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(S2.Colors.primarySurface)
                    }
                }
            }
            .padding(.horizontal, S2.Spacing.lg)
            .padding(.vertical, S2.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: S2.CornerRadius.md)
                    .fill(isSelected ? S2.Colors.secondarySurface : S2.Colors.secondarySurface.opacity(0.6))
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    VStack(spacing: 12) {
        OnboardingSelectionRow(title: "Finances", isSelected: false) {}
        OnboardingSelectionRow(title: "Mental Health", isSelected: true) {}
        OnboardingSelectionRow(title: "Spirituality", isSelected: false) {}
    }
    .padding()
    .background(S2.Colors.primarySurface)
}


