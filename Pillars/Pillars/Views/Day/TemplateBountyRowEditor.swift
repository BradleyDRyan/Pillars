import SwiftUI

struct TemplateBountyDraftRow: Identifiable, Hashable {
    let id: UUID
    var pillarId: String?
    var pointsText: String

    init(
        id: UUID = UUID(),
        pillarId: String? = nil,
        pointsText: String = ""
    ) {
        self.id = id
        self.pillarId = pillarId
        self.pointsText = pointsText
    }
}

struct TemplateBountyRowEditor: View {
    let index: Int
    @Binding var row: TemplateBountyDraftRow
    let pillars: [Pillar]
    let onRemove: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: S2.MyDay.Spacing.sectionContent) {
            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.i(1)) {
                Text("Bounty \(index)")
                    .font(S2.MyDay.Typography.fieldLabel)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)

                Menu {
                    ForEach(sortedPillars) { pillar in
                        Button {
                            row.pillarId = pillar.id
                        } label: {
                            HStack {
                                Text(pillar.name)
                                if row.pillarId == pillar.id {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack(spacing: S2.MyDay.Spacing.compact) {
                        if let selectedPillar = selectedPillar {
                            PillarTagChip(
                                title: selectedPillar.name,
                                color: selectedPillar.colorValue
                            )
                        } else {
                            Text("Select pillar")
                                .font(S2.MyDay.Typography.fieldValue)
                                .foregroundColor(S2.MyDay.Colors.subtitleText)
                        }

                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .s2MyDayInputSurface(padding: S2.MyDay.Spacing.i(6))
                }
                .buttonStyle(.plain)
            }

            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.i(1)) {
                Text("Points")
                    .font(S2.MyDay.Typography.fieldLabel)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)

                TextField("0", text: $row.pointsText)
                    .keyboardType(.numberPad)
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .frame(width: S2.MyDay.Spacing.i(26), alignment: .leading)
                    .s2MyDayInputSurface(padding: S2.MyDay.Spacing.i(6))
            }

            Button(role: .destructive) {
                onRemove()
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                    .foregroundColor(S2.Colors.error)
                    .padding(S2.MyDay.Spacing.i(4))
                    .background(S2.MyDay.Colors.sectionBackground)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove bounty row")
        }
    }

    private var sortedPillars: [Pillar] {
        pillars.sorted { lhs, rhs in
            lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private var selectedPillar: Pillar? {
        guard let pillarId = row.pillarId else { return nil }
        return pillars.first(where: { $0.id == pillarId })
    }
}
