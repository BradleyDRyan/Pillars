import SwiftUI

struct PillarTemplatePickerView: View {
    @EnvironmentObject var viewModel: PillarsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var didLoadTemplates = false

    private var activeTemplates: [PillarTemplate] {
        viewModel.pillarTemplates
            .filter(\.isActive)
            .sorted { left, right in
                if left.order != right.order {
                    return left.order < right.order
                }
                return left.name.localizedCaseInsensitiveCompare(right.name) == .orderedAscending
            }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.Spacing.lg) {
                    Text("Choose a preset pillar to start with a tailored rubric.")
                        .font(S2.TextStyle.subheadline)
                        .foregroundColor(S2.Colors.secondaryText)

                    if viewModel.isLoadingTemplates && activeTemplates.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, S2.Spacing.xl)
                    } else {
                        ForEach(activeTemplates) { template in
                            NavigationLink {
                                PillarFormView(
                                    mode: .createFromTemplate(template),
                                    onCompleted: {
                                        dismiss()
                                    }
                                )
                                .environmentObject(viewModel)
                            } label: {
                                templateRow(template)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    NavigationLink {
                        PillarFormView(
                            mode: .createCustom,
                            onCompleted: {
                                dismiss()
                            }
                        )
                        .environmentObject(viewModel)
                    } label: {
                        customPillarRow
                    }
                    .buttonStyle(.plain)

                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(S2.TextStyle.footnote)
                            .foregroundColor(S2.Colors.error)
                    }
                }
                .padding(S2.Spacing.lg)
            }
            .background(S2.Colors.surface.ignoresSafeArea())
            .navigationTitle("Add Pillar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .task {
                guard !didLoadTemplates else { return }
                didLoadTemplates = true
                await viewModel.loadPillarTemplates(force: true)
            }
        }
    }

    @ViewBuilder
    private func templateRow(_ template: PillarTemplate) -> some View {
        let iconToken = viewModel.normalizeIconToken(template.iconToken) ?? viewModel.defaultIconToken
        let colorToken = viewModel.normalizeColorToken(template.colorToken)
            ?? viewModel.defaultColorToken(forIconToken: iconToken)
        HStack(spacing: S2.Spacing.md) {
            let iconColor = viewModel.colorValue(forColorToken: colorToken)
            Image(systemName: viewModel.iconSystemName(forToken: iconToken))
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(iconColor)
                .frame(width: S2.Spacing.xxxl + S2.Spacing.xs, height: S2.Spacing.xxxl + S2.Spacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: S2.CornerRadius.sm)
                        .fill(iconColor.opacity(0.15))
                )

            VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                Text(template.name)
                    .font(S2.TextStyle.body)
                    .foregroundColor(S2.Colors.primaryText)
                Text("\(template.rubricItems.count) default rubric items")
                    .font(S2.TextStyle.caption)
                    .foregroundColor(S2.Colors.secondaryText)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(S2.Colors.secondaryText)
        }
        .padding(S2.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: S2.CornerRadius.md)
                .fill(S2.Colors.secondarySurface)
        )
    }

    private var customPillarRow: some View {
        HStack(spacing: S2.Spacing.md) {
            Image(systemName: "plus.circle")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(S2.Colors.primaryText)

            VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                Text("Custom Pillar")
                    .font(S2.TextStyle.body)
                    .foregroundColor(S2.Colors.primaryText)

                Text("Starts with an empty rubric.")
                    .font(S2.TextStyle.caption)
                    .foregroundColor(S2.Colors.secondaryText)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(S2.Colors.secondaryText)
        }
        .padding(S2.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: S2.CornerRadius.md)
                .fill(S2.Colors.secondarySurface)
        )
    }
}

#Preview {
    PillarTemplatePickerView()
        .environmentObject(PillarsViewModel())
}
