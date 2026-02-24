import SwiftUI

struct ActionDayView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager

    @StateObject private var viewModel = ActionViewModel()
    @StateObject private var pillarDataSource = PillarPickerDataSource()

    @State private var selectedDate = Calendar.current.startOfDay(for: Date())
    @State private var showingCreateActionSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionGap) {
                    header
                    createActionCard
                    actionsSection(title: "Pending", items: viewModel.pendingActions, isDoneSection: false)
                    actionsSection(title: "Done", items: viewModel.doneActions, isDoneSection: true)
                }
                .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
                .padding(.vertical, S2.MyDay.Spacing.pageVertical)
            }
            .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
            .navigationTitle("Day")
        }
        .task(id: firebaseManager.currentUser?.uid) {
            guard let userId = firebaseManager.currentUser?.uid else {
                viewModel.stopListening()
                pillarDataSource.stopListening()
                viewModel.actions = []
                return
            }
            pillarDataSource.startListening(userId: userId)
            viewModel.load(date: dateString(from: selectedDate), ensure: true)
        }
        .onChange(of: selectedDate) { _, newValue in
            viewModel.load(date: dateString(from: newValue), ensure: true)
        }
        .sheet(isPresented: $showingCreateActionSheet) {
            CreateActionSheet { title in
                viewModel.createAction(title: title)
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: S2.MyDay.Spacing.sectionContent) {
            DatePicker(
                "Date",
                selection: $selectedDate,
                displayedComponents: [.date]
            )
            .datePickerStyle(.compact)
            .labelsHidden()

            Spacer(minLength: S2.MyDay.Spacing.rowMinGap)

            Button {
                viewModel.refresh(ensure: true)
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                    .foregroundColor(S2.MyDay.Colors.titleText)
            }
            .buttonStyle(.plain)
        }
    }

    private var createActionCard: some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionHeader) {
            Text("Add Action")
                .font(S2.MyDay.Typography.sectionTitle)
                .foregroundColor(S2.MyDay.Colors.titleText)

            S2Button(
                title: "Add Action",
                icon: "plus",
                variant: .primary,
                size: .small,
                fullWidth: true,
                centerContent: true
            ) {
                showingCreateActionSheet = true
            }

            if viewModel.isLoading {
                ProgressView("Loading…")
                    .font(S2.MyDay.Typography.helper)
                    .tint(S2.Colors.primaryBrand)
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(S2.MyDay.Typography.helper)
                    .foregroundColor(S2.Colors.error)
            }
        }
        .s2MyDaySectionCard()
    }

    @ViewBuilder
    private func actionsSection(title: String, items: [Action], isDoneSection: Bool) -> some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionContent) {
            Text(title)
                .font(S2.MyDay.Typography.sectionTitle)
                .foregroundColor(S2.MyDay.Colors.titleText)

            if items.isEmpty {
                Text(isDoneSection ? "No completed actions yet." : "No pending actions.")
                    .font(S2.MyDay.Typography.emptyState)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
            } else {
                VStack(spacing: S2.MyDay.Spacing.compact) {
                    ForEach(items) { action in
                        actionRow(action, isDoneSection: isDoneSection)
                    }
                }
            }
        }
        .s2MyDaySectionCard()
    }

    private func actionRow(_ action: Action, isDoneSection: Bool) -> some View {
        HStack(alignment: .top, spacing: S2.MyDay.Spacing.rowHorizontal) {
            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.compact) {
                HStack(spacing: S2.MyDay.Spacing.compact) {
                    Text(action.title)
                        .font(S2.MyDay.Typography.blockTitle)
                        .foregroundColor(S2.MyDay.Colors.titleText)

                    if action.isRecurring {
                        Image(systemName: "repeat")
                            .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                }

                if let notes = action.notes, !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(notes)
                        .font(S2.MyDay.Typography.blockSubtitle)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                }

                metadataBadges(action: action, isDoneSection: isDoneSection)
            }

            Spacer(minLength: S2.MyDay.Spacing.rowMinGap)

            if isDoneSection {
                Button {
                    viewModel.setStatus(actionId: action.id, status: .pending)
                } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                }
                .buttonStyle(.plain)
            } else {
                HStack(spacing: S2.MyDay.Spacing.compact) {
                    Menu {
                        Button("Skip") {
                            viewModel.setStatus(actionId: action.id, status: .skipped)
                        }
                        Button("Cancel") {
                            viewModel.setStatus(actionId: action.id, status: .canceled)
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                    .buttonStyle(.plain)

                    S2MyDayDoneButton(isCompleted: false, size: .compact) {
                        viewModel.setStatus(actionId: action.id, status: .completed)
                    }
                }
            }
        }
        .padding(.vertical, S2.MyDay.Spacing.rowVertical)
        .padding(.horizontal, S2.MyDay.Spacing.rowHorizontal)
        .s2MyDayListRowBackground()
    }

    private func statusBadge(_ status: ActionStatus) -> some View {
        let badgeColor = statusColor(status)
        return Text(status.rawValue.capitalized)
            .font(S2.MyDay.Typography.caption)
            .foregroundColor(badgeColor)
            .padding(.horizontal, S2.MyDay.Spacing.compact)
            .padding(.vertical, S2.MyDay.Spacing.i(1))
            .overlay(
                Capsule()
                    .stroke(badgeColor, lineWidth: S2.MyDay.Spacing.i(0.5))
            )
    }

    @ViewBuilder
    private func metadataBadges(action: Action, isDoneSection: Bool) -> some View {
        let allocations = pillarBountyAllocations(for: action)
        HStack(spacing: S2.MyDay.Spacing.compact) {
            if isDoneSection {
                statusBadge(action.status)
            }

            if !allocations.isEmpty {
                ForEach(allocations) { allocation in
                    PillarTagChip(
                        title: "\(allocation.name) +\(allocation.points)",
                        color: allocation.color
                    )
                }
            } else if !isDoneSection && shouldShowScoringBadge(for: action) {
                scoringBadge
            }
        }
    }

    private var scoringBadge: some View {
        HStack(spacing: S2.MyDay.Spacing.i(1.5)) {
            ProgressView()
                .controlSize(.small)
                .tint(S2.MyDay.Colors.interactiveTint)
            Text("Scoring…")
                .font(S2.MyDay.Typography.caption)
        }
        .foregroundColor(S2.MyDay.Colors.subtitleText)
        .padding(.horizontal, S2.MyDay.Spacing.compact)
        .padding(.vertical, S2.MyDay.Spacing.i(1))
        .background(S2.MyDay.Colors.sectionBackground.opacity(0.9))
        .clipShape(Capsule())
    }

    private func shouldShowScoringBadge(for action: Action) -> Bool {
        guard action.status == .pending else { return false }
        guard action.totalBountyPoints <= 0 else { return false }
        guard let createdAt = action.createdAt else { return false }
        return Date().timeIntervalSince1970 - createdAt < 20
    }

    private func statusColor(_ status: ActionStatus) -> Color {
        switch status {
        case .completed:
            return S2.Colors.accentGreen
        case .skipped:
            return S2.Colors.secondaryBrand
        case .canceled:
            return S2.Colors.error
        case .pending:
            return S2.MyDay.Colors.subtitleText
        }
    }

    private func dateString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter.string(from: date)
    }

    private struct PillarPointAllocation: Identifiable {
        let pillarId: String
        let name: String
        let color: Color
        let points: Int

        var id: String { pillarId }
    }

    private func pillarBountyAllocations(for action: Action) -> [PillarPointAllocation] {
        var pointsByPillarId: [String: Int] = [:]
        for bounty in action.bounties {
            let pillarId = bounty.pillarId.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !pillarId.isEmpty else { continue }
            let points = max(0, bounty.points)
            guard points > 0 else { continue }
            pointsByPillarId[pillarId, default: 0] += points
        }

        return pointsByPillarId.map { pillarId, points in
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
}

#Preview {
    ActionDayView()
        .environmentObject(FirebaseManager.shared)
}
