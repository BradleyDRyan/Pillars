//
//  RubricListView.swift
//  Pillars
//
//  Pillar rubric visibility in Pillar detail.
//

import SwiftUI

struct RubricContentView: View {
    let pillar: Pillar

    private var rubricItems: [PillarRubricItem] {
        pillar.displayRubricItems
    }

    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            summaryCard

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
}
