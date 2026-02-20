//
//  DayBlockView.swift
//  Pillars
//
//  Accordion row for a single day block
//

import SwiftUI
import UIKit

struct DayBlockView: View {
    struct PillarTagDisplay {
        let title: String
        let color: Color
    }

    @Binding var block: Block
    let customTypes: [CustomBlockType]
    let onDelete: () -> Void
    let titleOverride: String?
    let trailingOverride: String?
    let showIcon: Bool
    let pillarTag: PillarTagDisplay?
    let onPillarTap: (() -> Void)?
    @State private var isEditorPresented = false
    @State private var draftBlock: Block?

    init(
        block: Binding<Block>,
        customTypes: [CustomBlockType],
        onDelete: @escaping () -> Void,
        titleOverride: String? = nil,
        trailingOverride: String? = nil,
        showIcon: Bool = true,
        pillarTag: PillarTagDisplay? = nil,
        onPillarTap: (() -> Void)? = nil
    ) {
        self._block = block
        self.customTypes = customTypes
        self.onDelete = onDelete
        self.titleOverride = titleOverride
        self.trailingOverride = trailingOverride
        self.showIcon = showIcon
        self.pillarTag = pillarTag
        self.onPillarTap = onPillarTap
    }

    private var customType: CustomBlockType? {
        customTypes.first(where: { $0.id == block.typeId })
    }

    private var todoPrimaryTitle: String? {
        guard block.typeId == "todo" else { return nil }
        guard let items = block.checklistData?.items else { return nil }
        return items.compactMap { nonEmpty($0.title) }.first
    }

    private var title: String {
        if let todoPrimaryTitle {
            return todoPrimaryTitle
        }
        if let builtIn = block.blockType {
            return builtIn.name
        }
        if let customType {
            return customType.name
        }
        return block.displayTitle
    }

    private var rowTitle: String {
        titleOverride ?? title
    }

    private var expandedDescription: String {
        if let builtIn = block.blockType {
            return builtIn.description
        }
        if let customType {
            return customType.description
        }
        return "This block type no longer exists."
    }

    private var icon: String {
        if let customType {
            return customType.icon
        }
        return block.displayIcon
    }

    private var collapsedTrailingValue: String? {
        if let builtIn = block.blockType {
            return builtInCollapsedValue(for: builtIn)
        }
        if let customType {
            return customCollapsedValue(for: customType)
        }
        return nil
    }

    private var rowTrailingValue: String? {
        if let trailingOverride {
            let trimmed = trailingOverride.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        return collapsedTrailingValue
    }

    var body: some View {
        ListRow(swipeDelete: onDelete) {
            if showIcon {
                iconView(icon)
                    .frame(width: 20, height: 20)
            }
        } title: {
            Text(rowTitle)
                .font(S2.MyDay.Typography.blockTitle)
                .foregroundColor(S2.MyDay.Colors.titleText)
                .multilineTextAlignment(.leading)
                .lineLimit(1)
        } trailing: {
            HStack(spacing: S2.Spacing.xs) {
                if let pillarTag {
                    if let onPillarTap {
                        Button(action: onPillarTap) {
                            PillarTagChip(title: pillarTag.title, color: pillarTag.color)
                        }
                        .buttonStyle(.plain)
                    } else {
                        PillarTagChip(title: pillarTag.title, color: pillarTag.color)
                    }
                }

                if let rowTrailingValue {
                    Text(rowTrailingValue)
                        .font(S2.MyDay.Typography.valueStrong)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .frame(minWidth: 36, alignment: .trailing)
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            draftBlock = block
            isEditorPresented = true
        }
        .sheet(isPresented: $isEditorPresented) {
            editorSheet
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .onChange(of: isEditorPresented) { _, presented in
            if !presented {
                draftBlock = nil
            }
        }
    }

    private var editorSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.MyDay.Spacing.blockBody) {
                    Text(title)
                        .font(S2.MyDay.Typography.sectionTitle)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                        .lineLimit(2)

                    Text(expandedDescription)
                        .font(S2.MyDay.Typography.blockSubtitle)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    contentView(editorBinding)

                    Divider()
                        .overlay(S2.MyDay.Colors.divider)

                    Button(role: .destructive) {
                        isEditorPresented = false
                        onDelete()
                    } label: {
                        Label("Delete Block", systemImage: "trash")
                            .font(S2.MyDay.Typography.deleteAction)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(S2.MyDay.Colors.destructive)
                }
                .padding(S2.MyDay.Spacing.cardPadding)
            }
            .background(S2.MyDay.Colors.pageBackground)
            .navigationTitle("Edit Block")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        cancelEditing()
                    }
                    .font(S2.MyDay.Typography.helper)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        saveAndDismiss()
                    }
                    .font(S2.MyDay.Typography.helper)
                    .foregroundColor(.blue)
                }
            }
        }
    }

    private var editorBinding: Binding<Block> {
        Binding(
            get: { draftBlock ?? block },
            set: { draftBlock = $0 }
        )
    }

    private func saveAndDismiss() {
        if let draftBlock {
            block = draftBlock
        }
        isEditorPresented = false
    }

    private func cancelEditing() {
        isEditorPresented = false
    }

    @ViewBuilder
    private func contentView(_ editingBlock: Binding<Block>) -> some View {
        if let builtIn = editingBlock.wrappedValue.blockType {
            if builtIn.inputKind == .custom,
               let customType = customTypes.first(where: { $0.id == editingBlock.wrappedValue.typeId }) {
                CustomBlockView(block: editingBlock, typeDef: customType)
            } else {
                builtInContent(for: builtIn, block: editingBlock)
            }
        } else if let customType = customTypes.first(where: { $0.id == editingBlock.wrappedValue.typeId }) {
            CustomBlockView(block: editingBlock, typeDef: customType)
        } else {
            Text("This block type was removed. You can keep or delete this entry.")
                .font(S2.MyDay.Typography.body)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func builtInContent(for builtIn: BlockType, block: Binding<Block>) -> some View {
        switch builtIn.inputKind {
        case .sleep:
            SleepBlockView(data: Binding(
                get: { block.wrappedValue.sleepData ?? SleepData(durationHours: 8, quality: 3, bedtime: nil, wakeTime: nil) },
                set: {
                    var updated = block.wrappedValue
                    updated.sleepData = $0
                    block.wrappedValue = updated
                }
            ))
        case .sliders:
            SliderBlockView(data: Binding(
                get: { block.wrappedValue.sliderData ?? SliderData(sliders: []) },
                set: {
                    var updated = block.wrappedValue
                    updated.sliderData = $0
                    block.wrappedValue = updated
                }
            ))
        case .checklist:
            let checklistMode: ChecklistBlockView.Mode = {
                if builtIn.id == "todo" {
                    return .todo
                }
                if builtIn.id == "habits" {
                    return .habit
                }
                return .standard
            }()

            ChecklistBlockView(data: Binding(
                get: { block.wrappedValue.checklistData ?? ChecklistData(items: []) },
                set: {
                    var updated = block.wrappedValue
                    updated.checklistData = $0
                    block.wrappedValue = updated
                }
            ), mode: checklistMode)
        case .textFields:
            TextFieldBlockView(data: Binding(
                get: { block.wrappedValue.textFieldData ?? TextFieldData(fields: []) },
                set: {
                    var updated = block.wrappedValue
                    updated.textFieldData = $0
                    block.wrappedValue = updated
                }
            ))
        case .freeText:
            FreeTextBlockView(text: Binding(
                get: { block.wrappedValue.freeText ?? "" },
                set: {
                    var updated = block.wrappedValue
                    updated.freeText = $0
                    block.wrappedValue = updated
                }
            ))
        case .custom:
            if let customType = customTypes.first(where: { $0.id == block.wrappedValue.typeId }) {
                CustomBlockView(block: block, typeDef: customType)
            } else {
                Text("This custom block type is unavailable.")
                    .font(S2.MyDay.Typography.body)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func builtInCollapsedValue(for builtIn: BlockType) -> String? {
        switch builtIn.inputKind {
        case .sleep:
            guard let data = block.sleepData else { return nil }
            let percent = Int(round((Double(data.quality) / 5.0) * 100))
            return "\(percent)%"
        case .sliders:
            guard let sliders = block.sliderData?.sliders, !sliders.isEmpty else { return nil }
            let average = sliders.map(\.value).reduce(0, +) / Double(sliders.count)
            return percentString(value: average, min: 0, max: 10)
        case .checklist:
            guard let items = block.checklistData?.items, !items.isEmpty else { return nil }
            let completed = items.filter(\.isCompleted).count
            let percent = Int(round((Double(completed) / Double(items.count)) * 100))
            return "\(percent)%"
        case .textFields:
            guard let fields = block.textFieldData?.fields, !fields.isEmpty else { return nil }
            let filledCount = fields.filter { nonEmpty($0.value) != nil }.count
            let percent = Int(round((Double(filledCount) / Double(fields.count)) * 100))
            return "\(percent)%"
        case .freeText:
            return nonEmpty(block.freeText) == nil ? nil : "Set"
        case .custom:
            return nil
        }
    }

    private func customCollapsedValue(for type: CustomBlockType) -> String? {
        guard let values = block.customData else { return nil }

        for field in type.fields {
            guard let value = values.first(where: { $0.id == field.id }) else { continue }

            switch field.type {
            case .slider:
                if let number = value.numberValue {
                    let lower = field.min ?? 0
                    let upper = field.max ?? 10
                    return percentString(value: number, min: lower, max: upper)
                }
            case .rating:
                if let number = value.numberValue {
                    let lower = field.min ?? 1
                    let upper = field.max ?? 5
                    return percentString(value: number, min: lower, max: upper)
                }
            case .number:
                if let number = value.numberValue {
                    return formatNumber(number)
                }
            case .toggle:
                if let boolValue = value.boolValue {
                    return boolValue ? "On" : "Off"
                }
            case .text, .multiline:
                if nonEmpty(value.textValue) != nil {
                    return "Set"
                }
            }
        }

        return nil
    }

    private func nonEmpty(_ string: String?) -> String? {
        guard let string else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func percentString(value: Double, min: Double, max: Double) -> String {
        guard max > min else {
            return "\(Int(round(value)))%"
        }
        let clampedValue = Swift.max(min, Swift.min(max, value))
        let ratio = (clampedValue - min) / (max - min)
        let percent = Int(round(ratio * 100))
        return "\(percent)%"
    }

    private func formatNumber(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(format: "%.1f", value)
    }

    @ViewBuilder
    private func iconView(_ icon: String) -> some View {
        if UIImage(systemName: icon) != nil {
            Image(systemName: icon)
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(S2.MyDay.Colors.rowIconTint)
                .font(.system(size: 16, weight: .semibold))
        } else {
            Text(icon)
                .font(.system(size: 16))
        }
    }
}
