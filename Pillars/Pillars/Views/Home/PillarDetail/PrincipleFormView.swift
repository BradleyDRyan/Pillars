//
//  PrincipleFormView.swift
//  Pillars
//
//  Form for creating and editing principles
//

import SwiftUI

struct PrincipleFormView: View {
    enum Mode {
        case create(pillarId: String)
        case edit(Principle)
    }
    
    let mode: Mode
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = PrinciplesViewModel()
    
    @State private var title: String = ""
    @State private var description: String = ""
    @State private var priority: Int = 3
    @State private var showingError = false
    @State private var errorMessage = ""
    
    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }
    
    private var pillarId: String {
        switch mode {
        case .create(let id): return id
        case .edit(let principle): return principle.pillarId ?? ""
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $title)
                        .font(.system(size: 17))
                    
                    TextField("Description", text: $description, axis: .vertical)
                        .font(.system(size: 17))
                        .lineLimit(3...6)
                }
                
                Section("Priority") {
                    Picker("Priority", selection: $priority) {
                        Text("Low").tag(1)
                        Text("Medium-Low").tag(2)
                        Text("Medium").tag(3)
                        Text("Medium-High").tag(4)
                        Text("High").tag(5)
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle(isEditing ? "Edit Principle" : "New Principle")
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
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isSaving)
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
            .onAppear {
                if case .edit(let principle) = mode {
                    title = principle.title
                    description = principle.description
                    priority = principle.priority
                }
            }
        }
    }
    
    private func save() async {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        
        do {
            switch mode {
            case .create(let pillarId):
                try await viewModel.createPrinciple(
                    pillarId: pillarId,
                    title: trimmedTitle,
                    description: trimmedDescription,
                    priority: priority
                )
            case .edit(let principle):
                try await viewModel.updatePrinciple(
                    principle,
                    title: trimmedTitle,
                    description: trimmedDescription,
                    priority: priority
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
    PrincipleFormView(mode: .create(pillarId: "123"))
}

#Preview("Edit") {
    PrincipleFormView(mode: .edit(Principle(
        id: "1",
        userId: "user1",
        pillarId: "123",
        title: "Quality Time",
        description: "I prioritize spending focused and meaningful time.",
        priority: 4
    )))
}



