//
//  ProjectFormView.swift
//  Squirrel2
//
//  Form for creating and editing projects
//

import SwiftUI

enum ProjectFormMode {
    case create
    case edit(Project)
    
    var title: String {
        switch self {
        case .create: return "New Project"
        case .edit: return "Edit Project"
        }
    }
    
    var buttonTitle: String {
        switch self {
        case .create: return "Create Project"
        case .edit: return "Save"
        }
    }
}

struct ProjectFormView: View {
    let mode: ProjectFormMode
    let onSave: (String, String, String, ProjectIcon?) -> Void
    
    @Environment(\.dismiss) private var dismiss
    
    @State private var name: String = ""
    @State private var description: String = ""
    @State private var selectedIcon: ProjectIcon = .folder
    @State private var showingIconPicker = false
    @FocusState private var focusedField: Field?
    
    private enum Field {
        case name
    }
    
    init(mode: ProjectFormMode, onSave: @escaping (String, String, String, ProjectIcon?) -> Void) {
        self.mode = mode
        self.onSave = onSave
        
        if case .edit(let project) = mode {
            _name = State(initialValue: project.name)
            _description = State(initialValue: project.description)
            _selectedIcon = State(initialValue: project.icon ?? .folder)
        }
    }
    
    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                ScrollView {
                    VStack(spacing: 24) {
                        // Icon button - 64x64 white circle with 36x36 icon
                        Button {
                            showingIconPicker = true
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(Color.white)
                                    .frame(width: 64, height: 64)
                                
                                selectedIcon.iconView(size: 36)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 8)
                        
                        // Name field in white container
                        HStack {
                            TextField("Project Name", text: $name)
                                .focused($focusedField, equals: .name)
                            
                            if !name.isEmpty {
                                Button {
                                    name = ""
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(.tertiary)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 16)
                        .background(Color(.systemBackground), in: Capsule())
                        
                        // Helper text
                        Text("Projects keep chats, files, and custom instructions in one place. Use them for ongoing work, or just to keep things tidy.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 24)
                    .frame(maxWidth: .infinity, alignment: .top)
                }
                
                VStack {
                    Spacer()
                    Button {
                        onSave(name, description, "#607D8B", selectedIcon)
                        dismiss()
                    } label: {
                        Text(mode.buttonTitle)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.large)
                    .tint(.primary)
                    .disabled(!isValid)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color(.systemGroupedBackground).ignoresSafeArea())
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(mode.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("", systemImage: "xmark") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingIconPicker) {
                IconPickerSheet(selectedIcon: $selectedIcon)
            }
            .onAppear {
                focusedField = .name
            }
        }
        .background(Color(.systemGroupedBackground))
    }
}

// MARK: - Icon Picker Sheet
struct IconPickerSheet: View {
    @Binding var selectedIcon: ProjectIcon
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                ForEach(ProjectIcon.allCases) { icon in
                    Button {
                        selectedIcon = icon
                        dismiss()
                    } label: {
                        HStack {
                            icon.iconView(size: 32)
                                .frame(width: 40, height: 40)
                            Text(icon.displayName)
                            Spacer()
                            if selectedIcon == icon {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.tint)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Choose Icon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

#Preview("Create") {
    ProjectFormView(mode: .create) { name, description, color, icon in
        print("Create: \(name), \(color), \(icon?.rawValue ?? "none")")
    }
}

#Preview("Edit") {
    ProjectFormView(
        mode: .edit(Project(
            id: "1",
            userId: "user1",
            name: "Health",
            description: "Health related items",
            color: "#CF263E",
            icon: .health,
            stats: Project.ProjectStats(conversationCount: 0, taskCount: 0, entryCount: 0, thoughtCount: 0),
            createdAt: Date(),
            updatedAt: Date()
        ))
    ) { name, description, color, icon in
        print("Edit: \(name), \(color), \(icon?.rawValue ?? "none")")
    }
}

#Preview("Icon Picker") {
    IconPickerSheet(selectedIcon: .constant(.health))
}
