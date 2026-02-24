//
//  PillarFormView.swift
//  Pillars
//
//  Form for creating and editing pillars
//

import SwiftUI

struct PillarFormView: View {
    enum Mode {
        case createCustom
        case createFromTemplate(PillarTemplate)
        case edit(Pillar)
    }

    let mode: Mode
    let onCompleted: (() -> Void)?
    @EnvironmentObject var viewModel: PillarsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var selectedIconToken: String = PillarIcon.default.rawValue
    @State private var selectedColorToken: String = PillarColorRegistry.fallbackToken
    @State private var hasManualColorSelection = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showIconPicker = false
    @State private var showColorPicker = false
    @State private var showContextEditor = false
    @State private var contextMarkdown: String = ""
    @State private var contextDraftMarkdown: String = ""
    @State private var didInitialize = false

    init(mode: Mode, onCompleted: (() -> Void)? = nil) {
        self.mode = mode
        self.onCompleted = onCompleted
    }

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private var normalizedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var titleText: String {
        isEditing ? "Edit Pillar" : "Customize Pillar"
    }

    private var actionTitle: String {
        isEditing ? "Save" : "Create"
    }

    private var canSubmit: Bool {
        !normalizedName.isEmpty && !isLoading
    }

    private var previewName: String {
        normalizedName.isEmpty ? "Untitled Pillar" : normalizedName
    }

    private var selectedIconSystemName: String {
        viewModel.iconSystemName(forToken: selectedIconToken)
    }

    private var selectedIconLabel: String {
        viewModel.iconLabel(forToken: selectedIconToken)
    }

    private var selectedColor: Color {
        viewModel.colorValue(forColorToken: selectedColorToken)
    }

    private var selectedColorLabel: String {
        if let choice = viewModel.activeVisualColors.first(where: { $0.id == selectedColorToken }) {
            return choice.label
        }
        return selectedColorToken
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }

    private var contextSummary: String {
        guard let normalizedContext = normalizedContextMarkdown, !normalizedContext.isEmpty else {
            return "Not set"
        }
        let singleLine = normalizedContext
            .components(separatedBy: .newlines)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if singleLine.isEmpty {
            return "Not set"
        }
        return singleLine
    }

    private var normalizedContextMarkdown: String? {
        let trimmed = contextMarkdown.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var body: some View {
        ScrollView {
            VStack(spacing: S2.Spacing.xl) {
                previewRow

                Button {
                    showIconPicker = true
                } label: {
                    heroIcon
                }
                .buttonStyle(.plain)

                VStack(spacing: S2.Spacing.sm) {
                    HStack(spacing: S2.Spacing.sm) {
                        TextField("Pillar name", text: $name)
                            .font(S2.TextStyle.title3)
                            .foregroundColor(S2.Colors.primaryText)
                            .autocorrectionDisabled()

                        Image(systemName: "pencil")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(S2.Colors.secondaryText)
                    }
                    .padding(.horizontal, S2.Spacing.lg)
                    .padding(.vertical, S2.Spacing.lg)
                    .background(S2.Colors.secondarySurface)
                    .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.lg, style: .continuous))
                }

                VStack(spacing: 0) {
                    settingsRow(
                        title: "Icon",
                        value: selectedIconLabel,
                        valueView: AnyView(
                            HStack(spacing: S2.Spacing.sm) {
                                Image(systemName: selectedIconSystemName)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(selectedColor)
                                Text(selectedIconLabel)
                                    .font(S2.TextStyle.body)
                                    .foregroundColor(S2.Colors.primaryText)
                            }
                        )
                    ) {
                        showIconPicker = true
                    }

                    Divider()
                        .padding(.horizontal, S2.Spacing.lg)

                    settingsRow(
                        title: "Color",
                        value: selectedColorLabel,
                        valueView: AnyView(
                            HStack(spacing: S2.Spacing.sm) {
                                Circle()
                                    .fill(selectedColor)
                                    .frame(width: S2.Spacing.lg, height: S2.Spacing.lg)
                                Text(selectedColorLabel)
                                    .font(S2.TextStyle.body)
                                    .foregroundColor(S2.Colors.primaryText)
                            }
                        )
                    ) {
                        showColorPicker = true
                    }

                    Divider()
                        .padding(.horizontal, S2.Spacing.lg)

                    settingsRow(
                        title: "Context",
                        value: contextSummary,
                        valueView: AnyView(
                            Text(contextSummary)
                                .font(S2.TextStyle.body)
                                .foregroundColor(S2.Colors.primaryText)
                                .lineLimit(1)
                        )
                    ) {
                        contextDraftMarkdown = contextMarkdown
                        showContextEditor = true
                    }
                }
                .background(S2.Colors.secondarySurface)
                .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.lg, style: .continuous))

                if let errorMessage {
                    Text(errorMessage)
                        .font(S2.TextStyle.footnote)
                        .foregroundColor(S2.Colors.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.horizontal, S2.Spacing.xl)
            .padding(.top, S2.Spacing.lg)
            .padding(.bottom, S2.Spacing.xxxl * 3)
        }
        .disabled(isLoading)
        .background(S2.Colors.surface.ignoresSafeArea())
        .navigationTitle(titleText)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
                .disabled(isLoading)
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: S2.Spacing.xs) {
                S2Button(
                    title: actionTitle,
                    variant: .primary,
                    size: .medium,
                    fullWidth: true,
                    centerContent: true
                ) {
                    Task {
                        await savePillar()
                    }
                }
                .disabled(!canSubmit)
                .opacity(canSubmit ? 1 : 0.5)
            }
            .padding(.horizontal, S2.Spacing.xl)
            .padding(.top, S2.Spacing.sm)
            .padding(.bottom, S2.Spacing.lg)
            .background(S2.Colors.surface)
        }
        .sheet(isPresented: $showIconPicker) {
            PillarIconPickerSheet(
                availableIcons: viewModel.availableIconsForPicker,
                selectedIconToken: $selectedIconToken,
                selectedColorToken: $selectedColorToken,
                iconSystemName: { token in
                    viewModel.iconSystemName(forToken: token)
                },
                iconPreviewColor: { token in
                    viewModel.colorValue(forColorToken: viewModel.defaultColorToken(forIconToken: token))
                },
                hasManualColorSelection: $hasManualColorSelection
            )
        }
        .sheet(isPresented: $showColorPicker) {
            PillarColorPickerSheet(
                choices: viewModel.activeVisualColors,
                selectedColorToken: $selectedColorToken,
                colorValueForToken: { token in
                    viewModel.colorValue(forColorToken: token)
                },
                onColorSelection: {
                    hasManualColorSelection = true
                }
            )
        }
        .sheet(isPresented: $showContextEditor) {
            contextEditorSheet
        }
        .onAppear {
            Task {
                await viewModel.loadPillarVisuals()
            }
            guard !didInitialize else { return }
            didInitialize = true
            configureInitialState()
        }
        .onChange(of: viewModel.activeVisualColors) { _, _ in
            if !hasManualColorSelection {
                selectedColorToken = viewModel.defaultColorToken(forIconToken: selectedIconToken)
            }
        }
        .onChange(of: viewModel.activeVisualIcons) { _, _ in
            if viewModel.availableIconsForPicker.contains(where: { $0.id == selectedIconToken }) == false {
                selectedIconToken = viewModel.defaultIconToken
                if !hasManualColorSelection {
                    selectedColorToken = viewModel.defaultColorToken(forIconToken: selectedIconToken)
                }
            }
        }
    }

    private var previewRow: some View {
        HStack(spacing: S2.Spacing.sm) {
            Image(systemName: selectedIconSystemName)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(selectedColor)

            Text(previewName)
                .font(S2.TextStyle.title3)
                .foregroundColor(S2.Colors.primaryText)

            Spacer()
        }
        .padding(.horizontal, S2.Spacing.lg)
        .padding(.vertical, S2.Spacing.md)
        .background(S2.Colors.secondarySurface)
        .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.lg, style: .continuous))
    }

    private var heroIcon: some View {
        ZStack {
            Circle()
                .fill(selectedColor.opacity(0.18))
                .frame(width: S2.Spacing.xxxl * 5, height: S2.Spacing.xxxl * 5)

            Image(systemName: selectedIconSystemName)
                .font(.system(size: S2.Spacing.xxxl * 1.5, weight: .semibold))
                .foregroundColor(selectedColor)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, S2.Spacing.md)
    }

    private func settingsRow(
        title: String,
        value: String,
        valueView: AnyView,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: S2.Spacing.sm) {
                Text(title)
                    .font(S2.TextStyle.body)
                    .foregroundColor(S2.Colors.primaryText)

                Spacer()

                valueView

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(S2.Colors.secondaryText)
            }
            .padding(.horizontal, S2.Spacing.lg)
            .padding(.vertical, S2.Spacing.md)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title): \(value)")
    }

    private func configureInitialState() {
        switch mode {
        case .createCustom:
            selectedIconToken = viewModel.defaultIconToken
            selectedColorToken = viewModel.defaultColorToken(forIconToken: selectedIconToken)
            name = ""
            contextMarkdown = ""
            hasManualColorSelection = false
        case .createFromTemplate(let template):
            selectedIconToken = viewModel.normalizeIconToken(template.iconToken) ?? viewModel.defaultIconToken
            selectedColorToken = viewModel.normalizeColorToken(template.colorToken)
                ?? viewModel.defaultColorToken(forIconToken: selectedIconToken)
            name = template.name
            contextMarkdown = ""
            hasManualColorSelection = false
        case .edit(let pillar):
            selectedIconToken = viewModel.normalizeIconToken(pillar.iconToken) ?? viewModel.defaultIconToken
            selectedColorToken = viewModel.normalizeColorToken(pillar.colorToken)
                ?? viewModel.colorToken(forHex: pillar.color)
                ?? viewModel.defaultColorToken(forIconToken: selectedIconToken)
            name = pillar.name
            contextMarkdown = pillar.contextMarkdown ?? ""
            hasManualColorSelection = true
        }
    }

    private var contextEditorSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: S2.Spacing.sm) {
                Text("Add context notes to help AI classify activities for this pillar.")
                    .font(S2.TextStyle.footnote)
                    .foregroundColor(S2.Colors.secondaryText)

                ZStack(alignment: .topLeading) {
                    TextEditor(text: $contextDraftMarkdown)
                        .font(S2.TextStyle.body)
                        .frame(minHeight: 220)
                        .textInputAutocapitalization(.sentences)

                    if contextDraftMarkdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text("Example: Emme is Bradley's wife. Acts of service for Emme should count toward this pillar.")
                            .font(S2.TextStyle.body)
                            .foregroundColor(S2.Colors.secondaryText)
                            .padding(.horizontal, S2.Spacing.xs)
                            .padding(.vertical, S2.Spacing.sm)
                    }
                }

                Spacer()
            }
            .padding(.horizontal, S2.Spacing.lg)
            .padding(.top, S2.Spacing.md)
            .background(S2.Colors.surface.ignoresSafeArea())
            .navigationTitle("Pillar Context")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showContextEditor = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        contextMarkdown = contextDraftMarkdown
                        showContextEditor = false
                    }
                }
            }
        }
    }

    private func savePillar() async {
        isLoading = true
        errorMessage = nil

        let resolvedColorToken = viewModel.normalizeColorToken(selectedColorToken)
            ?? viewModel.defaultColorToken(forIconToken: selectedIconToken)

        do {
            switch mode {
            case .edit(let pillar):
                try await viewModel.updatePillar(
                    pillar,
                    name: normalizedName,
                    colorToken: resolvedColorToken,
                    iconToken: selectedIconToken,
                    contextMarkdown: normalizedContextMarkdown,
                    updateContextMarkdown: true
                )
            case .createCustom:
                _ = try await viewModel.createPillar(
                    name: normalizedName,
                    colorToken: resolvedColorToken,
                    iconToken: selectedIconToken,
                    pillarType: .custom,
                    contextMarkdown: normalizedContextMarkdown
                )
            case .createFromTemplate(let template):
                _ = try await viewModel.createPillar(
                    name: normalizedName,
                    colorToken: resolvedColorToken,
                    iconToken: selectedIconToken,
                    pillarTypeRaw: template.pillarType,
                    contextMarkdown: normalizedContextMarkdown
                )
            }

            if let onCompleted {
                onCompleted()
            } else {
                dismiss()
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

private struct PillarIconPickerSheet: View {
    let availableIcons: [PillarVisualIcon]
    @Binding var selectedIconToken: String
    @Binding var selectedColorToken: String
    let iconSystemName: (String) -> String
    let iconPreviewColor: (String) -> Color
    @Binding var hasManualColorSelection: Bool

    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.adaptive(minimum: S2.Spacing.xxxl * 1.5), spacing: S2.Spacing.sm)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: S2.Spacing.sm) {
                    ForEach(availableIcons) { icon in
                        let isSelected = icon.id == selectedIconToken
                        let previewColor = iconPreviewColor(icon.id)
                        Button {
                            selectedIconToken = icon.id
                            if !hasManualColorSelection {
                                selectedColorToken = normalizedToken(icon.defaultColorToken)
                                    ?? PillarColorRegistry.fallbackToken
                            }
                            dismiss()
                        } label: {
                            VStack(spacing: S2.Spacing.xs) {
                                Image(systemName: iconSystemName(icon.id))
                                    .font(.system(size: 22, weight: .semibold))
                                    .foregroundColor(isSelected ? .white : previewColor)
                                    .frame(width: S2.Spacing.xxxl * 1.5, height: S2.Spacing.xxxl * 1.5)
                                    .background(
                                        RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous)
                                            .fill(isSelected ? previewColor : previewColor.opacity(0.15))
                                    )

                                Text(icon.label)
                                    .font(S2.TextStyle.caption2)
                                    .foregroundColor(S2.Colors.secondaryText)
                                    .lineLimit(1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, S2.Spacing.lg)
                .padding(.vertical, S2.Spacing.lg)
            }
            .background(S2.Colors.surface.ignoresSafeArea())
            .navigationTitle("Choose Icon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func normalizedToken(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let trimmed = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return trimmed.isEmpty ? nil : trimmed
    }
}

private struct PillarColorPickerSheet: View {
    let choices: [PillarVisualColor]
    @Binding var selectedColorToken: String
    let colorValueForToken: (String) -> Color
    let onColorSelection: () -> Void

    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.adaptive(minimum: S2.Spacing.xxxl * 1.8), spacing: S2.Spacing.sm)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.Spacing.lg) {
                    Text("Palette")
                        .font(S2.TextStyle.headline)
                        .foregroundColor(S2.Colors.primaryText)

                    LazyVGrid(columns: columns, spacing: S2.Spacing.sm) {
                        ForEach(choices) { choice in
                            Button {
                                selectedColorToken = choice.id
                                onColorSelection()
                                dismiss()
                            } label: {
                                VStack(spacing: S2.Spacing.xs) {
                                    Circle()
                                        .fill(colorValueForToken(choice.id))
                                        .frame(width: S2.Spacing.xxxl, height: S2.Spacing.xxxl)
                                        .overlay(
                                            Circle()
                                                .stroke(
                                                    selectedColorToken == choice.id
                                                        ? S2.Colors.primaryText
                                                        : Color.clear,
                                                    lineWidth: 2
                                                )
                                        )
                                    Text(choice.label)
                                        .font(S2.TextStyle.caption2)
                                        .foregroundColor(S2.Colors.secondaryText)
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, S2.Spacing.lg)
                .padding(.vertical, S2.Spacing.lg)
            }
            .background(S2.Colors.surface.ignoresSafeArea())
            .navigationTitle("Choose Color")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        PillarFormView(mode: .createCustom)
            .environmentObject(PillarsViewModel())
    }
}

#Preview("Edit") {
    NavigationStack {
        PillarFormView(
            mode: .edit(
                Pillar(
                    id: "preview",
                    userId: "user",
                    name: "Marriage",
                    color: "#E91E63",
                    icon: .heart
                )
            )
        )
        .environmentObject(PillarsViewModel())
    }
}
