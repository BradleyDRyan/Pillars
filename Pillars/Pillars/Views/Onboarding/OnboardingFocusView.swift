//
//  OnboardingFocusView.swift
//  Pillars
//
//  Single-step onboarding selection for pillar templates.
//

import SwiftUI

struct PillarOption: Identifiable, Equatable {
    let id: String
    let title: String
    let description: String?
    let pillarType: String
    let iconToken: String?
    let colorToken: String?
    let color: String

    init(
        id: String,
        title: String,
        color: String = "#607D8B",
        description: String? = nil,
        pillarType: String? = nil,
        iconToken: String? = nil,
        colorToken: String? = nil
    ) {
        let normalizedType = pillarType?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let resolvedType = (normalizedType?.isEmpty == false) ? (normalizedType ?? "") : id
        let normalizedIconToken = PillarIconRegistry.normalizeToken(iconToken)
        let normalizedColorToken = PillarColorRegistry.normalizeToken(colorToken)
            ?? PillarColorRegistry.token(forHex: color)
            ?? PillarIconRegistry.defaultColorToken(for: normalizedIconToken)

        self.id = id
        self.title = title
        self.description = description
        self.pillarType = resolvedType
        self.iconToken = normalizedIconToken
        self.colorToken = normalizedColorToken
        self.color = PillarColorRegistry.hex(for: normalizedColorToken)
    }

    var iconSystemName: String {
        PillarIconRegistry.systemName(for: iconToken)
    }

    var accentColor: Color {
        PillarColorRegistry.color(for: colorToken)
    }

    static let allPillars: [PillarOption] = fallbackTemplatePillars

    static let fallbackTemplatePillars: [PillarOption] = [
        PillarOption(
            id: "marriage",
            title: "Marriage",
            description: "Connection, quality time, and support for your partner.",
            pillarType: "marriage",
            iconToken: "heart",
            colorToken: "rose"
        ),
        PillarOption(
            id: "physical",
            title: "Physical",
            description: "Fitness, recovery, and daily health habits.",
            pillarType: "physical",
            iconToken: "figure",
            colorToken: "green"
        ),
        PillarOption(
            id: "career",
            title: "Career",
            description: "Deep work, milestones, and professional growth.",
            pillarType: "career",
            iconToken: "briefcase",
            colorToken: "slate"
        ),
        PillarOption(
            id: "finances",
            title: "Finances",
            description: "Budgeting, planning, and long-term money moves.",
            pillarType: "finances",
            iconToken: "dollarsign",
            colorToken: "blue"
        ),
        PillarOption(
            id: "house",
            title: "House",
            description: "Home maintenance, projects, and upkeep.",
            pillarType: "house",
            iconToken: "house",
            colorToken: "amber"
        ),
        PillarOption(
            id: "mental_health",
            title: "Mental Health",
            description: "Mindfulness, rest, and emotional wellbeing.",
            pillarType: "mental_health",
            iconToken: "brain",
            colorToken: "violet"
        ),
        PillarOption(
            id: "spiritual",
            title: "Spiritual",
            description: "Practice, community, and service.",
            pillarType: "spiritual",
            iconToken: "leaf",
            colorToken: "mint"
        ),
        PillarOption(
            id: "fatherhood",
            title: "Fatherhood",
            description: "Presence, teaching, and family moments.",
            pillarType: "fatherhood",
            iconToken: "figure2",
            colorToken: "orange"
        )
    ]
}

struct OnboardingFocusView: View {
    let pillars: [PillarOption]
    @Binding var selectedPillarIds: Set<String>
    let isSubmitting: Bool
    let onCreate: () -> Void

    private var selectedCount: Int {
        selectedPillarIds.count
    }

    private var callToActionTitle: String {
        if isSubmitting {
            return "Creating Pillars..."
        }
        if selectedCount == 1 {
            return "Create 1 Pillar"
        }
        return "Create \(selectedCount) Pillars"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.xxl) {
            Text("What areas of your life do you want to focus on?")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(S2.Colors.primaryText)
                .fixedSize(horizontal: false, vertical: true)

            Text("Select all that apply.")
                .font(.system(size: 15))
                .foregroundColor(S2.Colors.secondaryText)

            ScrollView(showsIndicators: false) {
                VStack(spacing: S2.Spacing.md) {
                    ForEach(pillars) { pillar in
                        PillarSelectionRow(
                            pillar: pillar,
                            isSelected: selectedPillarIds.contains(pillar.id)
                        ) {
                            toggleSelection(for: pillar.id)
                        }
                    }
                }
                .padding(.bottom, S2.Spacing.xl)
            }

            S2Button(
                title: callToActionTitle,
                icon: selectedCount > 0 ? "checkmark.circle.fill" : nil,
                variant: .primary,
                centerContent: true
            ) {
                onCreate()
            }
            .disabled(selectedCount == 0 || isSubmitting)
            .opacity((selectedCount == 0 || isSubmitting) ? 0.5 : 1)
        }
    }

    private func toggleSelection(for pillarId: String) {
        if selectedPillarIds.contains(pillarId) {
            selectedPillarIds.remove(pillarId)
        } else {
            selectedPillarIds.insert(pillarId)
        }
    }
}

private struct PillarSelectionRow: View {
    let pillar: PillarOption
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: S2.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(pillar.accentColor.opacity(0.16))
                        .frame(width: 36, height: 36)

                    Image(systemName: pillar.iconSystemName)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(pillar.accentColor)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(pillar.title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(S2.Colors.primaryText)

                    if let description = pillar.description,
                       !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(description)
                            .font(.system(size: 13))
                            .foregroundColor(S2.Colors.secondaryText)
                            .lineLimit(2)
                    }
                }

                Spacer()

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
    OnboardingFocusView(
        pillars: PillarOption.fallbackTemplatePillars,
        selectedPillarIds: .constant(["marriage", "career"]),
        isSubmitting: false
    ) {
        print("Create selected pillars")
    }
    .padding(.horizontal, S2.Spacing.xl)
    .padding(.top, S2.Spacing.xxxl)
    .background(S2.Colors.primarySurface)
}
