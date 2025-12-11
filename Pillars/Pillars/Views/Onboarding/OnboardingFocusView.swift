//
//  OnboardingFocusView.swift
//  Pillars
//
//  First onboarding step - select a pillar to focus on
//

import SwiftUI

struct PillarOption: Identifiable, Equatable {
    let id: String
    let title: String
    
    /// Fallback hardcoded pillars - used when API content is unavailable
    static let allPillars: [PillarOption] = [
        PillarOption(id: "family", title: "Family"),
        PillarOption(id: "marriage", title: "Marriage / Partner"),
        PillarOption(id: "parenting", title: "Parenting"),
        PillarOption(id: "faith", title: "Faith / Spirituality"),
        PillarOption(id: "fitness", title: "Fitness / Health"),
        PillarOption(id: "finances", title: "Finances"),
        PillarOption(id: "work", title: "Work"),
        PillarOption(id: "friendships", title: "Friendships"),
        PillarOption(id: "home", title: "Home"),
        PillarOption(id: "self", title: "Self"),
        PillarOption(id: "custom", title: "Custom")
    ]
}

struct OnboardingFocusView: View {
    @Binding var selectedPillar: PillarOption?
    @State private var customPillarName: String = ""
    @State private var showCustomInput: Bool = false
    @FocusState private var isCustomFieldFocused: Bool
    
    /// Pillars to display - can be from API or fallback
    var pillars: [PillarOption] = PillarOption.allPillars
    
    let onContinue: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.xxl) {
            // Title
            Text("What's one area of your life you want to be more intentional about?")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(S2.Colors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            
            // Selection options
            ScrollView(showsIndicators: false) {
                VStack(spacing: S2.Spacing.md) {
                    // Show pillars from ViewModel (or fallback)
                    ForEach(pillars) { pillar in
                        if pillar.id == "custom" {
                            // Custom option with text field
                            customPillarRow(pillar: pillar)
                        } else {
                            OnboardingSelectionRow(
                                title: pillar.title,
                                isSelected: selectedPillar?.id == pillar.id
                            ) {
                                selectPillar(pillar)
                            }
                        }
                    }
                    
                    // Always show custom option at the end if not in pillars
                    if !pillars.contains(where: { $0.id == "custom" }) {
                        customPillarRow(pillar: PillarOption(id: "custom", title: "Custom"))
                    }
                }
                .padding(.bottom, S2.Spacing.xxxl)
            }
        }
    }
    
    @ViewBuilder
    private func customPillarRow(pillar: PillarOption) -> some View {
        if showCustomInput {
            // Show text field for custom input
            HStack {
                TextField("Enter your pillar", text: $customPillarName)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundColor(S2.Colors.primaryText)
                    .focused($isCustomFieldFocused)
                    .onSubmit {
                        if !customPillarName.isEmpty {
                            let customPillar = PillarOption(id: "custom", title: customPillarName)
                            selectedPillar = customPillar
                            advanceAfterDelay()
                        }
                    }
                
                Spacer()
                
                // Checkmark button to confirm
                Button {
                    if !customPillarName.isEmpty {
                        let customPillar = PillarOption(id: "custom", title: customPillarName)
                        selectedPillar = customPillar
                        advanceAfterDelay()
                    }
                } label: {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(customPillarName.isEmpty ? S2.Colors.tertiaryText : S2.Colors.primaryText)
                }
                .disabled(customPillarName.isEmpty)
            }
            .padding(.horizontal, S2.Spacing.lg)
            .padding(.vertical, S2.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: S2.CornerRadius.md)
                    .fill(S2.Colors.secondarySurface)
            )
        } else {
            // Show regular row that expands to text field
            OnboardingSelectionRow(
                title: pillar.title,
                isSelected: false
            ) {
                withAnimation(.easeInOut(duration: 0.2)) {
                    showCustomInput = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    isCustomFieldFocused = true
                }
            }
        }
    }
    
    private func selectPillar(_ pillar: PillarOption) {
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedPillar = pillar
            showCustomInput = false
            customPillarName = ""
        }
        advanceAfterDelay()
    }
    
    private func advanceAfterDelay() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            onContinue()
        }
    }
}

#Preview {
    OnboardingFocusView(
        selectedPillar: .constant(nil),
        pillars: PillarOption.allPillars
    ) {
        print("Continue tapped")
    }
    .padding(.horizontal, S2.Spacing.xl)
    .padding(.top, S2.Spacing.xxxl)
    .background(S2.Colors.primarySurface)
}
