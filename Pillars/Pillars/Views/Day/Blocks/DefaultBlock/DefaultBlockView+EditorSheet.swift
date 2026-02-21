//
//  DefaultBlockView+EditorSheet.swift
//  Pillars
//
//  Editor sheet flow for standard Day blocks.
//  This file owns the edit modal, save action, and cancel action.
//

import SwiftUI

extension DefaultBlockView {
    var editorSheet: some View {
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
                    .foregroundColor(S2.MyDay.Colors.interactiveTint)
                }
            }
        }
    }

    var editorBinding: Binding<Block> {
        Binding(
            get: { draftBlock ?? block },
            set: { draftBlock = $0 }
        )
    }

    // Commits draft edits back to the bound Day block.
    func saveAndDismiss() {
        if let draftBlock {
            block = draftBlock
        }
        isEditorPresented = false
    }

    // Closes the sheet and drops local draft edits.
    func cancelEditing() {
        isEditorPresented = false
    }
}
