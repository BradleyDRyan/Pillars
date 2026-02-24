import SwiftUI

struct ActionTemplatesView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @ObservedObject var pillarDataSource: PillarPickerDataSource

    @StateObject private var viewModel = ActionTemplateViewModel()
    @State private var selectedTemplate: ActionTemplate?

    private struct PillarPointAllocation: Identifiable {
        let pillarId: String
        let name: String
        let color: Color
        let points: Int

        var id: String { pillarId }
    }

    private var activeTemplates: [ActionTemplate] {
        viewModel.templates.filter { template in
            template.archivedAt == nil && template.isActive
        }
    }

    private var inactiveTemplates: [ActionTemplate] {
        viewModel.templates.filter { template in
            template.archivedAt != nil || !template.isActive
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionGap) {
                templatesSection(
                    title: "Active",
                    emptyCopy: "No recurring templates yet.",
                    templates: activeTemplates
                )

                templatesSection(
                    title: "Inactive",
                    emptyCopy: "No paused or archived templates.",
                    templates: inactiveTemplates
                )

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .font(S2.MyDay.Typography.helper)
                        .foregroundColor(S2.Colors.error)
                }
            }
            .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
            .padding(.vertical, S2.MyDay.Spacing.pageVertical)
        }
        .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
        .navigationTitle("Templates")
        .sheet(item: $selectedTemplate) { template in
            ActionTemplateEditorSheet(
                template: template,
                pillars: pillarDataSource.pillars,
                viewModel: viewModel
            )
        }
        .task(id: firebaseManager.currentUser?.uid) {
            guard firebaseManager.currentUser?.uid != nil else {
                viewModel.stopListening()
                return
            }

            viewModel.load(includeInactive: true)
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }

    @ViewBuilder
    private func templatesSection(
        title: String,
        emptyCopy: String,
        templates: [ActionTemplate]
    ) -> some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionContent) {
            Text(title)
                .font(S2.MyDay.Typography.sectionTitle)
                .foregroundColor(S2.MyDay.Colors.titleText)

            if templates.isEmpty {
                Text(emptyCopy)
                    .font(S2.MyDay.Typography.emptyState)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
            } else {
                VStack(spacing: S2.MyDay.Spacing.compact) {
                    ForEach(templates) { template in
                        templateRow(template)
                    }
                }
            }
        }
        .s2MyDaySectionCard()
    }

    private func templateRow(_ template: ActionTemplate) -> some View {
        let allocations = bountyAllocations(for: template)
        let totalPoints = allocations.reduce(0) { $0 + $1.points }

        return Button {
            selectedTemplate = template
        } label: {
            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.compact) {
                HStack(alignment: .center, spacing: S2.MyDay.Spacing.compact) {
                    Text(template.title)
                        .font(S2.MyDay.Typography.blockTitle)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    statusBadge(for: template)
                }

                Text(cadenceLabel(for: template.cadence))
                    .font(S2.MyDay.Typography.blockSubtitle)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)

                if allocations.isEmpty {
                    Text("No bounties")
                        .font(S2.MyDay.Typography.caption)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                } else {
                    HStack(spacing: S2.MyDay.Spacing.compact) {
                        ForEach(allocations) { allocation in
                            PillarTagChip(
                                title: "\(allocation.name) +\(allocation.points)",
                                color: allocation.color
                            )
                        }

                        Text("Total \(totalPoints)")
                            .font(S2.MyDay.Typography.caption)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                }
            }
            .padding(.vertical, S2.MyDay.Spacing.rowVertical)
            .padding(.horizontal, S2.MyDay.Spacing.rowHorizontal)
            .s2MyDayListRowBackground()
        }
        .buttonStyle(.plain)
    }

    private func statusBadge(for template: ActionTemplate) -> some View {
        let isArchived = template.archivedAt != nil
        let label = isArchived ? "Archived" : (template.isActive ? "Active" : "Inactive")
        let color = isArchived ? S2.Colors.error : (template.isActive ? S2.Colors.accentGreen : S2.MyDay.Colors.subtitleText)

        return Text(label)
            .font(S2.MyDay.Typography.caption)
            .foregroundColor(color)
            .padding(.horizontal, S2.MyDay.Spacing.compact)
            .padding(.vertical, S2.MyDay.Spacing.i(1))
            .overlay(
                Capsule()
                    .stroke(color, lineWidth: S2.MyDay.Spacing.i(0.5))
            )
    }

    private func bountyAllocations(for template: ActionTemplate) -> [PillarPointAllocation] {
        var pointsByPillarId: [String: Int] = [:]
        for bounty in template.defaultBounties {
            let pillarId = bounty.pillarId.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !pillarId.isEmpty else { continue }
            let points = max(0, bounty.points)
            guard points > 0 else { continue }
            pointsByPillarId[pillarId, default: 0] += points
        }

        return pointsByPillarId
            .map { pillarId, points in
                let pillar = pillarDataSource.pillar(for: pillarId)
                return PillarPointAllocation(
                    pillarId: pillarId,
                    name: pillar?.name ?? "Pillar",
                    color: pillar?.colorValue ?? S2.MyDay.Colors.subtitleText,
                    points: points
                )
            }
            .sorted { lhs, rhs in
                if lhs.points != rhs.points {
                    return lhs.points > rhs.points
                }
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
    }

    private func cadenceLabel(for cadence: ActionCadence) -> String {
        switch cadence.type {
        case .daily:
            return "Daily"
        case .specificDays:
            let days = (cadence.daysOfWeek ?? [])
                .map { shortWeekday($0) }
                .joined(separator: ", ")
            return days.isEmpty ? "Specific Days" : "Specific Days • \(days)"
        case .weekly:
            let day = cadence.daysOfWeek?.first.map(shortWeekday) ?? "Day"
            return "Weekly • \(day)"
        }
    }

    private func shortWeekday(_ raw: String) -> String {
        switch raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "monday": return "Mon"
        case "tuesday": return "Tue"
        case "wednesday": return "Wed"
        case "thursday": return "Thu"
        case "friday": return "Fri"
        case "saturday": return "Sat"
        case "sunday": return "Sun"
        default: return raw.capitalized
        }
    }
}
