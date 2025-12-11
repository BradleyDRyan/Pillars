//
//  SaveFormView.swift
//  Pillars
//
//  Form for creating and editing saves (insights)
//

import SwiftUI

struct SaveFormView: View {
    enum Mode {
        case create(pillarId: String)
        case edit(Insight)
    }
    
    let mode: Mode
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = SavesViewModel()
    
    @State private var content: String = ""
    @State private var showingError = false
    @State private var errorMessage = ""
    
    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What do you want to save?", text: $content, axis: .vertical)
                        .font(.system(size: 17))
                        .lineLimit(4...10)
                }
                
                Section {
                    Text("Save quotes, wisdom, reflections, or anything meaningful related to this pillar.")
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle(isEditing ? "Edit" : "New Save")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Add") {
                        Task {
                            await save()
                        }
                    }
                    .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isSaving)
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
            .onAppear {
                if case .edit(let insight) = mode {
                    content = insight.content
                }
            }
        }
    }
    
    private func save() async {
        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
        
        do {
            switch mode {
            case .create(let pillarId):
                try await viewModel.createSave(
                    pillarId: pillarId,
                    content: trimmedContent
                )
            case .edit(let insight):
                try await viewModel.updateSave(
                    insight,
                    content: trimmedContent
                )
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
}

#Preview("Create") {
    SaveFormView(mode: .create(pillarId: "123"))
}

#Preview("Edit") {
    SaveFormView(mode: .edit(Insight(
        id: "1",
        userId: "user1",
        pillarId: "123",
        content: "The best time to plant a tree was 20 years ago. The second best time is now."
    )))
}

