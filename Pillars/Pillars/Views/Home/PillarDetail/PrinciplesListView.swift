//
//  PrinciplesListView.swift
//  Pillars
//
//  List of principles for a pillar
//

import SwiftUI

// MARK: - Content View (no ScrollView - for embedding)

struct PrinciplesContentView: View {
    let pillar: Pillar
    
    @StateObject private var viewModel = PrinciplesViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var showingAddSheet = false
    @State private var principleToEdit: Principle?
    @State private var principleToDelete: Principle?
    
    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 200)
            } else if viewModel.principles.isEmpty {
                VStack(spacing: 16) {
                    ContentEmptyState(
                        icon: "list.bullet.rectangle",
                        title: "No Principles Yet",
                        description: "Add guiding principles for this pillar"
                    )
                    
                    Button {
                        showingAddSheet = true
                    } label: {
                        Label("Add Principle", systemImage: "plus")
                            .font(.system(size: 15, weight: .medium))
                    }
                    .buttonStyle(.bordered)
                    .tint(pillar.colorValue)
                }
            } else {
                LazyVStack(spacing: 0) {
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
                    .padding(.bottom, 8)
                    
                    ForEach(Array(viewModel.principles.enumerated()), id: \.element.id) { index, principle in
                        PrincipleRow(
                            number: index + 1,
                            title: principle.title,
                            description: principle.description,
                            isFirst: index == 0
                        )
                        .contentShape(Rectangle())
                        .contextMenu {
                            Button {
                                principleToEdit = principle
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            
                            Button(role: .destructive) {
                                principleToDelete = principle
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        
                        if index < viewModel.principles.count - 1 {
                            Divider()
                                .background(Color(hex: "f3f3f3"))
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            PrincipleFormView(mode: .create(pillarId: pillar.id))
        }
        .sheet(item: $principleToEdit) { principle in
            PrincipleFormView(mode: .edit(principle))
        }
        .confirmationDialog(
            "Delete Principle",
            isPresented: Binding(
                get: { principleToDelete != nil },
                set: { if !$0 { principleToDelete = nil } }
            ),
            presenting: principleToDelete
        ) { principle in
            Button("Delete", role: .destructive) {
                Task {
                    try? await viewModel.deletePrinciple(principle)
                }
            }
        } message: { principle in
            Text("Are you sure you want to delete \"\(principle.title)\"?")
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

// MARK: - Standalone View (with ScrollView)

struct PrinciplesListView: View {
    let pillar: Pillar
    
    var body: some View {
        ScrollView {
            PrinciplesContentView(pillar: pillar)
        }
    }
}

#Preview {
    PrinciplesListView(pillar: Pillar(
        id: "1",
        userId: "user1",
        name: "Emme",
        color: "#c6316d",
        icon: .heart
    ))
    .environmentObject(FirebaseManager.shared)
}
