//
//  PillarFormView.swift
//  Pillars
//
//  Form for creating and editing pillars
//

import SwiftUI

struct PillarFormView: View {
    enum Mode {
        case create
        case edit(Pillar)
    }
    
    let mode: Mode
    @EnvironmentObject var viewModel: PillarsViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var name: String = ""
    @State private var description: String = ""
    @State private var selectedIcon: PillarIcon = .star
    @State private var selectedColor: Color = .blue
    @State private var emoji: String = ""
    @State private var useEmoji: Bool = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }
    
    private var existingPillar: Pillar? {
        if case .edit(let pillar) = mode { return pillar }
        return nil
    }
    
    var body: some View {
        NavigationStack {
            Form {
                // Name
                Section {
                    TextField("Name", text: $name)
                        .font(.squirrelBody)
                } header: {
                    Text("Name")
                }
                
                // Description
                Section {
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .font(.squirrelBody)
                        .lineLimit(3...6)
                } header: {
                    Text("Description")
                }
                
                // Icon
                Section {
                    Toggle("Use Emoji", isOn: $useEmoji)
                    
                    if useEmoji {
                        TextField("Emoji", text: $emoji)
                            .font(.system(size: 32))
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 50))], spacing: 12) {
                            ForEach(PillarIcon.allCases) { icon in
                                Button {
                                    selectedIcon = icon
                                    selectedColor = icon.defaultColor
                                } label: {
                                    Image(systemName: icon.systemName)
                                        .font(.system(size: 20, weight: .medium))
                                        .foregroundColor(icon == selectedIcon ? .white : icon.defaultColor)
                                        .frame(width: 44, height: 44)
                                        .background(
                                            RoundedRectangle(cornerRadius: 10)
                                                .fill(icon == selectedIcon ? icon.defaultColor : icon.defaultColor.opacity(0.15))
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                } header: {
                    Text("Icon")
                }
                
                // Color
                Section {
                    ColorPicker("Color", selection: $selectedColor)
                } header: {
                    Text("Color")
                }
                
                // Error message
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.squirrelFootnote)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Pillar" : "New Pillar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Create") {
                        Task {
                            await savePillar()
                        }
                    }
                    .disabled(name.isEmpty || isLoading)
                }
            }
            .onAppear {
                if let pillar = existingPillar {
                    name = pillar.name
                    description = pillar.description
                    selectedColor = pillar.colorValue
                    if let icon = pillar.icon {
                        selectedIcon = icon
                    }
                    if let existingEmoji = pillar.emoji, !existingEmoji.isEmpty {
                        emoji = existingEmoji
                        useEmoji = true
                    }
                }
            }
        }
    }
    
    private func savePillar() async {
        isLoading = true
        errorMessage = nil
        
        let colorHex = selectedColor.toHex() ?? "#000000"
        
        do {
            if let pillar = existingPillar {
                try await viewModel.updatePillar(
                    pillar,
                    name: name,
                    description: description,
                    color: colorHex,
                    icon: useEmoji ? nil : selectedIcon,
                    emoji: useEmoji ? emoji : nil
                )
            } else {
                _ = try await viewModel.createPillar(
                    name: name,
                    description: description,
                    color: colorHex,
                    icon: useEmoji ? nil : selectedIcon,
                    emoji: useEmoji ? emoji : nil
                )
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
}

// MARK: - Color Extension for Hex

extension Color {
    func toHex() -> String? {
        guard let components = UIColor(self).cgColor.components else { return nil }
        
        let r = components[0]
        let g = components.count > 1 ? components[1] : r
        let b = components.count > 2 ? components[2] : r
        
        return String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}

#Preview {
    PillarFormView(mode: .create)
        .environmentObject(PillarsViewModel())
}




