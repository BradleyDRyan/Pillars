//
//  DefaultBlockView+ContentRouting.swift
//  Pillars
//
//  Routes each block type to the correct editor UI.
//  In plain terms: choose the right form for this block.
//

import SwiftUI

extension DefaultBlockView {
    @ViewBuilder
    func contentView(_ editingBlock: Binding<Block>) -> some View {
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
    func builtInContent(for builtIn: BlockType, block: Binding<Block>) -> some View {
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
}
