//
//  DefaultBlockView.swift
//  Pillars
//
//  Main wrapper for a standard Day row.
//  This file keeps only input/state and top-level wiring.
//

import SwiftUI
import UIKit

struct DefaultBlockView: View {
    @Binding var block: Block
    let customTypes: [BlockType]
    let onDelete: () -> Void
    let titleOverride: String?
    let trailingOverride: String?
    let isCheckable: Bool
    let isChecked: Bool
    let onCheckToggle: (() -> Void)?
    let pillarTag: BlockPillarTagDisplay?
    let onPillarTap: (() -> Void)?
    let leadingIconName: String?
    let showLeadingAccessory: Bool
    let doneCompletedIconName: String
    let doneIncompleteIconName: String
    let compactCompletedStyle: Bool
    let compactCompletedTrailingText: String?

    // Kept internal so helper extensions in other files can read/write editor state.
    @State var isEditorPresented = false
    @State var draftBlock: Block?
    @Environment(\.dayCardVisualStyle) var cardStyle

    init(
        block: Binding<Block>,
        customTypes: [BlockType],
        onDelete: @escaping () -> Void,
        titleOverride: String? = nil,
        trailingOverride: String? = nil,
        isCheckable: Bool = false,
        isChecked: Bool = false,
        onCheckToggle: (() -> Void)? = nil,
        pillarTag: BlockPillarTagDisplay? = nil,
        onPillarTap: (() -> Void)? = nil,
        leadingIconName: String? = nil,
        showLeadingAccessory: Bool = true,
        compactCompletedStyle: Bool = false,
        compactCompletedTrailingText: String? = nil,
        doneCompletedIconName: String = "checkmark",
        doneIncompleteIconName: String = "checkmark"
    ) {
        self._block = block
        self.customTypes = customTypes
        self.onDelete = onDelete
        self.titleOverride = titleOverride
        self.trailingOverride = trailingOverride
        self.isCheckable = isCheckable
        self.isChecked = isChecked
        self.onCheckToggle = onCheckToggle
        self.pillarTag = pillarTag
        self.onPillarTap = onPillarTap
        self.leadingIconName = leadingIconName
        self.showLeadingAccessory = showLeadingAccessory
        self.compactCompletedStyle = compactCompletedStyle
        self.compactCompletedTrailingText = compactCompletedTrailingText
        self.doneCompletedIconName = doneCompletedIconName
        self.doneIncompleteIconName = doneIncompleteIconName
    }

    var body: some View {
        CoreCardShell(
            onDelete: onDelete,
            onTap: {
                draftBlock = block
                isEditorPresented = true
            }
        ) {
            if compactCompletedStyle && isChecked {
                compactCompletedTodoRow
            } else {
                standardRow
            }
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
}
