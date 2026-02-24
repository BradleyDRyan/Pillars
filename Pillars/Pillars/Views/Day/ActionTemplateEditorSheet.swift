import SwiftUI

struct ActionTemplateEditorSheet: View {
    let template: ActionTemplate
    let pillars: [Pillar]
    @ObservedObject var viewModel: ActionTemplateViewModel

    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var notes: String
    @State private var cadenceType: ActionCadenceType
    @State private var selectedWeekdays: Set<String>
    @State private var isActive: Bool
    @State private var bountyRows: [TemplateBountyDraftRow]
    @State private var formErrorMessage: String?
    @State private var infoMessage: String?
    @State private var isSaving = false
    @State private var isReclassifying = false
    @State private var isArchiving = false

    init(
        template: ActionTemplate,
        pillars: [Pillar],
        viewModel: ActionTemplateViewModel
    ) {
        self.template = template
        self.pillars = pillars
        self.viewModel = viewModel

        _title = State(initialValue: template.title)
        _notes = State(initialValue: template.notes ?? "")
        _cadenceType = State(initialValue: template.cadence.type)
        _selectedWeekdays = State(initialValue: Set((template.cadence.daysOfWeek ?? []).map { $0.lowercased() }))
        _isActive = State(initialValue: template.archivedAt == nil ? template.isActive : false)
        _bountyRows = State(initialValue: Self.makeDraftRows(from: template.defaultBounties))
    }

    private static let weekdayOrder: [String] = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
    ]

    private var isArchivedTemplate: Bool {
        template.archivedAt != nil
    }

    private var normalizedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var normalizedNotes: String? {
        let trimmed = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private var sortedWeekdays: [String] {
        Self.weekdayOrder.filter { selectedWeekdays.contains($0) }
    }

    private var draftCadence: ActionCadence {
        switch cadenceType {
        case .daily:
            return ActionCadence(type: .daily, daysOfWeek: [])
        case .specificDays:
            return ActionCadence(type: .specificDays, daysOfWeek: sortedWeekdays)
        case .weekly:
            return ActionCadence(type: .weekly, daysOfWeek: Array(sortedWeekdays.prefix(1)))
        }
    }

    private var canAddBountyRow: Bool {
        bountyRows.count < 3
    }

    private var isBusy: Bool {
        isSaving || isReclassifying || isArchiving
    }

    private var validationError: String? {
        if normalizedTitle.isEmpty {
            return "Title is required."
        }

        if cadenceType == .specificDays && sortedWeekdays.isEmpty {
            return "Specific days cadence requires at least one day."
        }

        if cadenceType == .weekly && sortedWeekdays.count != 1 {
            return "Weekly cadence requires exactly one day."
        }

        if bountyRows.count > 3 {
            return "You can add at most 3 bounty rows."
        }

        var seenPillars = Set<String>()
        var totalPoints = 0

        for row in bountyRows {
            let pillarId = row.pillarId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if pillarId.isEmpty {
                return "Each bounty row must select a pillar."
            }

            if seenPillars.contains(pillarId) {
                return "Each pillar can only appear once."
            }
            seenPillars.insert(pillarId)

            guard let points = Int(row.pointsText.trimmingCharacters(in: .whitespacesAndNewlines)) else {
                return "Each bounty row must have integer points."
            }
            if points < 1 || points > 100 {
                return "Each bounty row points value must be between 1 and 100."
            }

            totalPoints += points
            if totalPoints > 150 {
                return "Total bounty points cannot exceed 150."
            }
        }

        return nil
    }

    private var draftTotalPoints: Int {
        bountyRows.reduce(0) { partialResult, row in
            partialResult + (Int(row.pointsText.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0)
        }
    }

    private var canSave: Bool {
        !isArchivedTemplate && validationError == nil && !isBusy
    }

    private var canReclassify: Bool {
        !isArchivedTemplate && reclassifyValidationError == nil && !isBusy
    }

    private var reclassifyValidationError: String? {
        if normalizedTitle.isEmpty {
            return "Title is required."
        }

        if cadenceType == .specificDays && sortedWeekdays.isEmpty {
            return "Specific days cadence requires at least one day."
        }

        if cadenceType == .weekly && sortedWeekdays.count != 1 {
            return "Weekly cadence requires exactly one day."
        }

        return nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionGap) {
                    detailsSection
                    cadenceSection
                    bountiesSection

                    if let infoMessage {
                        Text(infoMessage)
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }

                    if let formErrorMessage {
                        Text(formErrorMessage)
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.Colors.error)
                    }

                    if let sharedError = viewModel.errorMessage,
                       !sharedError.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(sharedError)
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.Colors.error)
                    }
                }
                .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
                .padding(.vertical, S2.MyDay.Spacing.pageVertical)
            }
            .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
            .navigationTitle("Template")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving..." : "Save") {
                        Task {
                            await saveTemplate()
                        }
                    }
                    .disabled(!canSave)
                    .foregroundColor(
                        canSave
                            ? S2.MyDay.Colors.interactiveTint
                            : S2.MyDay.Colors.subtitleText
                    )
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if !isArchivedTemplate {
                            Button(role: .destructive) {
                                Task {
                                    await archiveTemplate()
                                }
                            } label: {
                                Label("Archive Template", systemImage: "archivebox")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                    .disabled(isBusy || isArchivedTemplate)
                }
            }
        }
    }

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionContent) {
            fieldGroup("Title") {
                TextField("Action template title", text: $title)
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .s2MyDayInputSurface()
                    .disabled(isArchivedTemplate)
            }

            fieldGroup("Notes") {
                TextField("Optional notes", text: $notes, axis: .vertical)
                    .lineLimit(3...6)
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .s2MyDayInputSurface()
                    .disabled(isArchivedTemplate)
            }

            fieldGroup("State") {
                Toggle(isOn: $isActive) {
                    Text("Active")
                        .font(S2.MyDay.Typography.fieldValue)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                }
                .disabled(isArchivedTemplate)
                .tint(S2.MyDay.Colors.interactiveTint)
                .s2MyDayInputSurface()

                if isArchivedTemplate {
                    Text("Archived templates are read-only.")
                        .font(S2.MyDay.Typography.caption)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                }
            }
        }
        .s2MyDaySectionCard()
    }

    private var cadenceSection: some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionContent) {
            Text("Cadence")
                .font(S2.MyDay.Typography.sectionTitle)
                .foregroundColor(S2.MyDay.Colors.titleText)

            Picker("Cadence", selection: $cadenceType) {
                Text("Daily").tag(ActionCadenceType.daily)
                Text("Specific Days").tag(ActionCadenceType.specificDays)
                Text("Weekly").tag(ActionCadenceType.weekly)
            }
            .pickerStyle(.segmented)
            .disabled(isArchivedTemplate)

            if cadenceType != .daily {
                weekdaySelector
            }
        }
        .s2MyDaySectionCard()
    }

    private var bountiesSection: some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionContent) {
            HStack {
                Text("Default Bounties")
                    .font(S2.MyDay.Typography.sectionTitle)
                    .foregroundColor(S2.MyDay.Colors.titleText)

                Spacer(minLength: S2.MyDay.Spacing.rowMinGap)

                Text("Total \(draftTotalPoints)")
                    .font(S2.MyDay.Typography.fieldLabel)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
            }

            if bountyRows.isEmpty {
                Text("No bounty rows yet.")
                    .font(S2.MyDay.Typography.emptyState)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
            } else {
                VStack(spacing: S2.MyDay.Spacing.sectionContent) {
                    ForEach(Array(bountyRows.indices), id: \.self) { index in
                        TemplateBountyRowEditor(
                            index: index + 1,
                            row: $bountyRows[index],
                            pillars: pillars
                        ) {
                            bountyRows.remove(at: index)
                        }
                        .disabled(isArchivedTemplate || isBusy)
                    }
                }
            }

            HStack(spacing: S2.MyDay.Spacing.compact) {
                S2Button(
                    title: "Add Bounty",
                    icon: "plus",
                    variant: .secondary,
                    size: .small,
                    fullWidth: false
                ) {
                    bountyRows.append(TemplateBountyDraftRow())
                }
                .disabled(!canAddBountyRow || isBusy || isArchivedTemplate)
                .opacity((!canAddBountyRow || isBusy || isArchivedTemplate) ? 0.5 : 1)

                S2Button(
                    title: isReclassifying ? "Reclassifying..." : "Reclassify from title + notes",
                    icon: "sparkles",
                    variant: .secondary,
                    size: .small,
                    fullWidth: false
                ) {
                    Task {
                        await reclassifyTemplate()
                    }
                }
                .disabled(!canReclassify)
                .opacity(canReclassify ? 1 : 0.5)
            }
        }
        .s2MyDaySectionCard()
    }

    private var weekdaySelector: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: S2.MyDay.Spacing.compact), count: 4)

        return LazyVGrid(columns: columns, spacing: S2.MyDay.Spacing.compact) {
            ForEach(Self.weekdayOrder, id: \.self) { day in
                let isSelected = selectedWeekdays.contains(day)

                Button {
                    if cadenceType == .weekly {
                        selectedWeekdays = [day]
                    } else if isSelected {
                        selectedWeekdays.remove(day)
                    } else {
                        selectedWeekdays.insert(day)
                    }
                } label: {
                    Text(shortLabel(for: day))
                        .font(S2.MyDay.Typography.fieldLabel)
                        .foregroundColor(isSelected ? S2.MyDay.Colors.sectionBackground : S2.MyDay.Colors.titleText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, S2.MyDay.Spacing.i(2))
                        .background(isSelected ? S2.MyDay.Colors.interactiveTint : S2.MyDay.Colors.sectionBackground)
                        .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func fieldGroup<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.compact) {
            Text(title)
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            content()
        }
    }

    private func shortLabel(for day: String) -> String {
        switch day {
        case "monday": return "Mon"
        case "tuesday": return "Tue"
        case "wednesday": return "Wed"
        case "thursday": return "Thu"
        case "friday": return "Fri"
        case "saturday": return "Sat"
        case "sunday": return "Sun"
        default: return day.capitalized
        }
    }

    private func reclassifyTemplate() async {
        formErrorMessage = nil
        infoMessage = nil

        if let reclassifyValidationError {
            formErrorMessage = reclassifyValidationError
            return
        }

        isReclassifying = true
        defer { isReclassifying = false }

        let response = await viewModel.reclassifyTemplate(
            templateId: template.id,
            title: normalizedTitle,
            notes: normalizedNotes,
            cadence: draftCadence,
            isActive: isActive
        )

        guard let response else {
            formErrorMessage = viewModel.errorMessage ?? "Failed to reclassify template."
            return
        }

        applyMutation(response)
        infoMessage = "Template bounties reclassified."
    }

    private func saveTemplate() async {
        formErrorMessage = nil
        infoMessage = nil

        if let validationError {
            formErrorMessage = validationError
            return
        }

        let mappedBounties = bountyRows.compactMap { row -> ActionBounty? in
            guard let pillarId = row.pillarId?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !pillarId.isEmpty,
                  let points = Int(row.pointsText.trimmingCharacters(in: .whitespacesAndNewlines)) else {
                return nil
            }
            return ActionBounty(
                pillarId: pillarId,
                rubricItemId: nil,
                points: points
            )
        }

        isSaving = true
        defer { isSaving = false }

        let response = await viewModel.updateTemplate(
            templateId: template.id,
            title: normalizedTitle,
            notes: normalizedNotes,
            cadence: draftCadence,
            isActive: isActive,
            defaultBounties: mappedBounties
        )

        guard let response else {
            formErrorMessage = viewModel.errorMessage ?? "Failed to save template."
            return
        }

        applyMutation(response)
        if let propagated = response.propagatedActionsCount, propagated > 0 {
            infoMessage = "Saved. Updated \(propagated) upcoming actions."
        } else {
            infoMessage = "Saved."
        }
    }

    private func archiveTemplate() async {
        isArchiving = true
        defer { isArchiving = false }

        let response = await viewModel.archiveTemplate(templateId: template.id)
        guard response != nil else {
            formErrorMessage = viewModel.errorMessage ?? "Failed to archive template."
            return
        }

        dismiss()
    }

    private func applyMutation(_ response: ActionTemplateMutationResponse) {
        title = response.actionTemplate.title
        notes = response.actionTemplate.notes ?? ""
        cadenceType = response.actionTemplate.cadence.type
        selectedWeekdays = Set((response.actionTemplate.cadence.daysOfWeek ?? []).map { $0.lowercased() })
        isActive = response.actionTemplate.archivedAt == nil ? response.actionTemplate.isActive : false
        bountyRows = Self.makeDraftRows(from: response.actionTemplate.defaultBounties)
        formErrorMessage = nil
    }

    private static func makeDraftRows(from bounties: [ActionBounty]) -> [TemplateBountyDraftRow] {
        bounties.map { bounty in
            TemplateBountyDraftRow(
                pillarId: bounty.pillarId,
                pointsText: String(bounty.points)
            )
        }
    }
}
