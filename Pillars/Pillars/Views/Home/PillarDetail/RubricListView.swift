//
//  RubricListView.swift
//  Pillars
//
//  Pillar rubric visibility in Pillar detail.
//

import SwiftUI
import UIKit

struct RubricContentView: View {
    let pillar: Pillar
    @EnvironmentObject var viewModel: PillarsViewModel
    @State private var showingAddRubricItemSheet = false
    @State private var addActivityType = ""
    @State private var addTier = ""
    @State private var addPoints = "15"
    @State private var addExamples = ""
    @State private var addRubricErrorMessage: String?
    @State private var isSavingRubricItem = false

    private var rubricItems: [PillarRubricItem] {
        pillar.displayRubricItems
    }

    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            summaryCard
            addRubricItemButton

            if rubricItems.isEmpty {
                ContentEmptyState(
                    icon: "list.bullet.clipboard",
                    title: "No rubric items",
                    description: "Add rubric items to define how this pillar earns points."
                )
            } else {
                LazyVStack(spacing: S2.Spacing.sm) {
                    ForEach(rubricItems) { item in
                        RubricItemRow(item: item, accent: pillar.colorValue)
                    }
                }
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
        .padding(.bottom, S2.Spacing.lg)
        .sheet(isPresented: $showingAddRubricItemSheet) {
            addRubricItemSheet
        }
    }

    private var summaryCard: some View {
        HStack(spacing: S2.Spacing.md) {
            VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                Text("Rubric Items")
                    .font(S2.TextStyle.subheadline)
                    .foregroundColor(S2.Colors.secondaryText)

                Text("\(rubricItems.count)")
                    .font(S2.TextStyle.title)
                    .foregroundColor(S2.Colors.primaryText)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: S2.Spacing.xs) {
                Text("Top Bounty")
                    .font(S2.TextStyle.subheadline)
                    .foregroundColor(S2.Colors.secondaryText)

                Text("+\(rubricItems.map(\.points).max() ?? 0)")
                    .font(S2.TextStyle.title2)
                    .foregroundColor(pillar.colorValue)
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
        .padding(.vertical, S2.Spacing.md)
        .background(S2.Colors.elevated)
        .cornerRadius(S2.CornerRadius.lg)
        .shadow(
            color: S2.Shadow.md.color,
            radius: S2.Shadow.md.radius,
            x: S2.Shadow.md.x,
            y: S2.Shadow.md.y
        )
    }

    private var addRubricItemButton: some View {
        S2Button(
            title: "Add Rubric Item",
            icon: "plus",
            variant: .secondary,
            size: .small,
            fullWidth: false
        ) {
            resetAddRubricDraft()
            showingAddRubricItemSheet = true
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var canSaveRubricItem: Bool {
        let activity = addActivityType.trimmingCharacters(in: .whitespacesAndNewlines)
        let tier = addTier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !activity.isEmpty, !tier.isEmpty else {
            return false
        }
        guard let points = Int(addPoints.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return false
        }
        return points > 0 && points <= 200
    }

    private var addRubricItemSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.Spacing.lg) {
                    Text("Create a new rubric item for this pillar. Each item defines a points bucket the classifier can use.")
                        .font(S2.TextStyle.subheadline)
                        .foregroundColor(S2.Colors.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)

                    rubricField(
                        title: "Activity Type",
                        text: $addActivityType,
                        placeholder: "Home Project"
                    )

                    rubricField(
                        title: "Tier",
                        text: $addTier,
                        placeholder: "Small"
                    )

                    rubricField(
                        title: "Points",
                        text: $addPoints,
                        placeholder: "15",
                        keyboardType: .numberPad
                    )

                    rubricField(
                        title: "Examples (Optional)",
                        text: $addExamples,
                        placeholder: "Swap light switches, replace fixtures, patch wall...",
                        multiline: true
                    )

                    if let addRubricErrorMessage {
                        Text(addRubricErrorMessage)
                            .font(S2.TextStyle.footnote)
                            .foregroundColor(S2.Colors.error)
                    }

                    S2Button(
                        title: isSavingRubricItem ? "Saving..." : "Save Rubric Item",
                        icon: "checkmark.circle.fill",
                        variant: .primary,
                        centerContent: true
                    ) {
                        Task {
                            await saveRubricItem()
                        }
                    }
                    .disabled(!canSaveRubricItem || isSavingRubricItem)
                    .opacity((!canSaveRubricItem || isSavingRubricItem) ? 0.5 : 1)
                }
                .padding(S2.Spacing.lg)
            }
            .background(S2.Colors.surface.ignoresSafeArea())
            .navigationTitle("Add Rubric Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingAddRubricItemSheet = false
                    }
                    .disabled(isSavingRubricItem)
                }
            }
        }
    }

    @ViewBuilder
    private func rubricField(
        title: String,
        text: Binding<String>,
        placeholder: String,
        keyboardType: UIKeyboardType = .default,
        multiline: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: S2.Spacing.xs) {
            Text(title)
                .font(S2.TextStyle.caption)
                .foregroundColor(S2.Colors.secondaryText)

            if multiline {
                TextField(
                    "",
                    text: text,
                    prompt: Text(placeholder).foregroundColor(S2.Colors.tertiaryText),
                    axis: .vertical
                )
                .lineLimit(3...6)
                .font(S2.TextStyle.body)
                .foregroundColor(S2.Colors.primaryText)
                .padding(.horizontal, S2.Spacing.md)
                .padding(.vertical, S2.Spacing.sm)
                .background(S2.Colors.secondarySurface)
                .cornerRadius(S2.CornerRadius.md)
            } else {
                TextField(
                    "",
                    text: text,
                    prompt: Text(placeholder).foregroundColor(S2.Colors.tertiaryText)
                )
                .font(S2.TextStyle.body)
                .foregroundColor(S2.Colors.primaryText)
                .keyboardType(keyboardType)
                .padding(.horizontal, S2.Spacing.md)
                .padding(.vertical, S2.Spacing.sm)
                .background(S2.Colors.secondarySurface)
                .cornerRadius(S2.CornerRadius.md)
            }
        }
    }

    private func saveRubricItem() async {
        guard canSaveRubricItem else { return }

        let activity = addActivityType.trimmingCharacters(in: .whitespacesAndNewlines)
        let tier = addTier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let points = Int(addPoints.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            addRubricErrorMessage = "Points must be a number."
            return
        }

        let examples = addExamples.trimmingCharacters(in: .whitespacesAndNewlines)
        let now = Date().timeIntervalSince1970
        let itemId = "ri_\(slug(activity))_\(slug(tier))_\(UUID().uuidString.prefix(8).lowercased())"
        let newItem = PillarRubricItem(
            id: itemId,
            activityType: activity,
            tier: tier,
            label: nil,
            points: points,
            examples: examples.isEmpty ? nil : examples,
            createdAt: now,
            updatedAt: now
        )

        isSavingRubricItem = true
        addRubricErrorMessage = nil
        defer { isSavingRubricItem = false }

        do {
            try await viewModel.updatePillar(
                pillar,
                rubricItems: rubricItems + [newItem]
            )
            showingAddRubricItemSheet = false
            resetAddRubricDraft()
        } catch {
            addRubricErrorMessage = error.localizedDescription
        }
    }

    private func resetAddRubricDraft() {
        addActivityType = ""
        addTier = ""
        addPoints = "15"
        addExamples = ""
        addRubricErrorMessage = nil
    }

    private func slug(_ value: String) -> String {
        let normalized = value
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        return normalized.isEmpty ? "item" : normalized
    }
}

private struct RubricItemRow: View {
    let item: PillarRubricItem
    let accent: Color

    var body: some View {
        HStack(alignment: .top, spacing: S2.Spacing.md) {
            VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                Text(item.displayLabel)
                    .font(S2.TextStyle.headline)
                    .foregroundColor(S2.Colors.primaryText)
                    .lineLimit(2)

                Text("\(item.activityType) · \(item.tier)")
                    .font(S2.TextStyle.caption)
                    .foregroundColor(S2.Colors.secondaryText)

                if let examples = item.examples, !examples.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(examples)
                        .font(S2.TextStyle.footnote)
                        .foregroundColor(S2.Colors.secondaryText)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: S2.Spacing.sm)

            Text("+\(item.points)")
                .font(S2.TextStyle.callout)
                .foregroundColor(accent)
                .padding(.horizontal, S2.Spacing.md)
                .padding(.vertical, S2.Spacing.xs)
                .background(accent.opacity(0.1))
                .cornerRadius(S2.CornerRadius.sm)
        }
        .padding(.horizontal, S2.Spacing.md)
        .padding(.vertical, S2.Spacing.sm)
        .background(S2.Colors.elevated)
        .cornerRadius(S2.CornerRadius.md)
        .shadow(
            color: S2.Shadow.sm.color,
            radius: S2.Shadow.sm.radius,
            x: S2.Shadow.sm.x,
            y: S2.Shadow.sm.y
        )
    }
}

#Preview {
    RubricContentView(
        pillar: Pillar(
            id: "pillar1",
            userId: "u1",
            name: "Marriage",
            color: "#c6316d",
            icon: .heart,
            rubricItems: Pillar.defaultRubricItems(for: "Marriage")
        )
    )
    .environmentObject(PillarsViewModel())
}
