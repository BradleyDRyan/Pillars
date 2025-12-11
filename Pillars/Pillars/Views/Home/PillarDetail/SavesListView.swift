//
//  SavesListView.swift
//  Pillars
//
//  List of saved content (wisdom, resources, quotes) for a pillar
//

import SwiftUI

// MARK: - Content View (no ScrollView - for embedding)

struct SavesContentView: View {
    let pillar: Pillar
    
    @StateObject private var viewModel = SavesViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var showingAddSheet = false
    @State private var saveToEdit: Insight?
    @State private var saveToDelete: Insight?
    
    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 200)
            } else if viewModel.saves.isEmpty {
                VStack(spacing: 16) {
                    ContentEmptyState(
                        icon: "bookmark",
                        title: "No Saves Yet",
                        description: "Capture wisdom, quotes, and resources here"
                    )
                    
                    Button {
                        showingAddSheet = true
                    } label: {
                        Label("Add Save", systemImage: "plus")
                            .font(.system(size: 15, weight: .medium))
                    }
                    .buttonStyle(.bordered)
                    .tint(pillar.colorValue)
                }
            } else {
                LazyVStack(spacing: 12) {
                    // Add button at the top
                    HStack {
                        Spacer()
                        Button {
                            showingAddSheet = true
                        } label: {
                            Label("Add", systemImage: "plus")
                                .font(.system(size: 14, weight: .medium))
                        }
                        .buttonStyle(.bordered)
                        .tint(pillar.colorValue)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    
                    ForEach(viewModel.saves) { save in
                        SaveRow(save: save, accentColor: pillar.colorValue)
                            .contextMenu {
                                Button {
                                    saveToEdit = save
                                } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                
                                Button(role: .destructive) {
                                    saveToDelete = save
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
                .padding(.horizontal, 20)
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            SaveFormView(mode: .create(pillarId: pillar.id))
        }
        .sheet(item: $saveToEdit) { save in
            SaveFormView(mode: .edit(save))
        }
        .confirmationDialog(
            "Delete Save",
            isPresented: Binding(
                get: { saveToDelete != nil },
                set: { if !$0 { saveToDelete = nil } }
            ),
            presenting: saveToDelete
        ) { save in
            Button("Delete", role: .destructive) {
                Task {
                    try? await viewModel.deleteSave(save)
                }
            }
        } message: { _ in
            Text("Are you sure you want to delete this save?")
        }
        .onAppear {
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId, pillarId: pillar.id)
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }
}

// MARK: - Save Row

struct SaveRow: View {
    let save: Insight
    let accentColor: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(save.content)
                .font(.system(size: 15))
                .foregroundColor(.primary)
                .lineLimit(4)
            
            HStack {
                if let source = save.source {
                    Text(sourceLabel(source))
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Text(timeAgo(save.createdAt))
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private func sourceLabel(_ source: InsightSource) -> String {
        switch source {
        case .conversation:
            return "From conversation"
        case .manual:
            return "Manually added"
        case .reflection:
            return "Reflection"
        }
    }
    
    private func timeAgo(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Standalone View (with ScrollView)

struct SavesListView: View {
    let pillar: Pillar
    
    var body: some View {
        ScrollView {
            SavesContentView(pillar: pillar)
        }
    }
}

#Preview {
    SavesListView(pillar: Pillar(
        id: "1",
        userId: "user1",
        name: "Career",
        color: "#868E96",
        icon: .briefcase
    ))
    .environmentObject(FirebaseManager.shared)
}
