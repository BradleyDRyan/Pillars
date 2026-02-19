//
//  ChecklistBlockView.swift
//  Pillars
//
//  Generic block view for checklist data (habits, todos)
//

import SwiftUI

struct ChecklistBlockView: View {
    @Binding var data: ChecklistData
    @State private var newItemText = ""
    @FocusState private var isAddFieldFocused: Bool

    var body: some View {
        VStack(spacing: 4) {
            ForEach($data.items) { $item in
                HStack(spacing: 12) {
                    Button {
                        item.isCompleted.toggle()
                    } label: {
                        Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 22))
                            .foregroundColor(item.isCompleted ? .accentColor : .secondary.opacity(0.5))
                    }
                    TextField("Item", text: $item.title)
                        .font(.system(size: 15))
                        .strikethrough(item.isCompleted, color: .secondary)
                        .foregroundColor(item.isCompleted ? .secondary : .primary)
                    Spacer()
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            data.items.removeAll { $0.id == item.id }
                        }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.secondary.opacity(0.5))
                    }
                }
                .padding(.vertical, 4)
            }

            // Add item row
            HStack(spacing: 12) {
                Image(systemName: "plus.circle")
                    .font(.system(size: 22))
                    .foregroundColor(.accentColor.opacity(0.7))
                TextField("Add item…", text: $newItemText)
                    .font(.system(size: 15))
                    .focused($isAddFieldFocused)
                    .onSubmit { commitNewItem() }
                if !newItemText.isEmpty {
                    Button { commitNewItem() } label: {
                        Image(systemName: "return")
                            .font(.system(size: 14))
                            .foregroundColor(.accentColor)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func commitNewItem() {
        let trimmed = newItemText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        withAnimation(.easeInOut(duration: 0.2)) {
            data.items.append(ChecklistItem(id: UUID().uuidString, title: trimmed, isCompleted: false))
        }
        newItemText = ""
    }
}
