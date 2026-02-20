//
//  PillarsTabView.swift
//  Pillars
//
//  Pillars tab - displays pillars grid
//

import SwiftUI
import FirebaseAuth

struct PillarsTabView: View {
    @StateObject private var viewModel = PillarsViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var showingAddPillar = false
    @State private var selectedPillar: Pillar?
    
    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    S2ScreenHeaderView(title: "Pillars")

                    if viewModel.pillars.isEmpty && !viewModel.isLoading {
                        emptyState
                    } else {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(viewModel.pillars) { pillar in
                                Button {
                                    selectedPillar = pillar
                                } label: {
                                    PillarTile(pillar: pillar)
                                }
                                .buttonStyle(.pressScale)
                            }
                        }
                        .padding(.top, 4)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(Color(UIColor.systemBackground))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAddPillar = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddPillar) {
                PillarFormView(mode: .create)
                    .environmentObject(viewModel)
            }
            .navigationDestination(item: $selectedPillar) { pillar in
                PillarDetailView(pillar: pillar)
                    .environmentObject(viewModel)
            }
        }
        .task(id: firebaseManager.currentUser?.uid) {
            guard let userId = firebaseManager.currentUser?.uid else {
                viewModel.stopListening()
                return
            }
            viewModel.startListening(userId: userId)
        }
    }
    
    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "building.columns")
                .font(.system(size: 64))
                .foregroundColor(.secondary.opacity(0.5))
            
            Text("No Pillars Yet")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(.primary)
            
            Text("Create your first pillar to organize your principles and insights.")
                .font(.system(size: 15))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)
            
            Button {
                showingAddPillar = true
            } label: {
                Text("Create Pillar")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color.blue)
                    .cornerRadius(12)
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 48)
        .padding(.bottom, 24)
    }
}

#Preview {
    PillarsTabView()
        .environmentObject(FirebaseManager.shared)
}

