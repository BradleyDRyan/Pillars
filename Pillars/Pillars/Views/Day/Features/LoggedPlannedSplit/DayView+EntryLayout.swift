import SwiftUI

// Layout for the full entries area on Day screen.
// This file controls the two-section structure: planned (top) and logged (bottom).
extension DayView {
    // Renders the complete entries section for a loaded day.
    func dayEntriesContent(day: Day) -> some View {
        let entries = dayEntries(from: day)
        let logged = entries.filter { $0.status == .logged }
        let planned = entries.filter { $0.status == .planned }
        let style = dayCardVisualStyle

        return ScrollView {
            VStack(alignment: .leading, spacing: CGFloat(style.dayCardGap)) {
                // Date title and week selector.
                dateHeader

                // Top section: planned items.
                dayEntriesSection(
                    entries: planned,
                    emptyText: "No planned entries.",
                    cardBackground: style.cardBackgroundBelowLine,
                    isCompletedSection: false
                )

                // Visual split between planned and logged actions.
                Divider()
                .overlay(S2.Semantics.onSurfaceSecondary.opacity(0.2))

                // Bottom section: logged/completed items.
                dayEntriesSection(
                    entries: logged,
                    emptyText: "No entries completed yet.",
                    cardBackground: style.cardBackgroundAboveLine,
                    isCompletedSection: true
                )
            }
            .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
            .padding(.vertical, S2.MyDay.Spacing.pageVertical)
        }
        .background(style.dayViewBackground.color)
    }

    // Shared renderer for one section (top or bottom).
    @ViewBuilder
    func dayEntriesSection(
        entries: [DayEntry],
        emptyText: String,
        cardBackground: DayCardStyleColor,
        isCompletedSection: Bool
    ) -> some View {
        let sectionStyle = cardStyle(forCompletedSection: isCompletedSection)

        if entries.isEmpty {
            // Section-specific empty state text.
            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionContent) {
                Text(emptyText)
                    .font(S2.MyDay.Typography.emptyState)
                    .foregroundColor(S2.Semantics.onSurfaceSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, S2.MyDay.Spacing.emptyStateVertical)
            }
        } else {
            VStack(alignment: .leading, spacing: CGFloat(dayCardVisualStyle.dayCardGap)) {
                ForEach(entries) { entry in
                    dayEntryRow(for: entry)
                        .matchedGeometryEffect(id: entry.id, in: completionCardNamespace)
                        .transition(dayEntryTransferTransition)
                }
            }
            .environment(\.dayCardVisualStyle, sectionStyle)
            .environment(\.dayCardSectionBackground, cardBackground)
        }
    }

    // Small visual differences between top and bottom cards.
    func cardStyle(forCompletedSection isCompletedSection: Bool) -> DayCardVisualStyle {
        var style = dayCardVisualStyle

        if isCompletedSection {
            style.hasShadow = true
            style.hasBorder = true
            return style
        }
        return style
    }
}
