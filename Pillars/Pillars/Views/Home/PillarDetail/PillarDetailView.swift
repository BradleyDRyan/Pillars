//
//  PillarDetailView.swift
//  Pillars
//
//  Detail view for a single pillar with paginated tabs
//

import SwiftUI

struct PillarDetailView: View {
    let pillar: Pillar
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var viewModel: PillarsViewModel
    @State private var showingEditSheet = false
    @State private var selectedTab = 0
    @State private var inputText = ""
    @FocusState private var isComposerFocused: Bool
    
    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                PillarHeroSection(pillar: pillar)
                
                // Segmented control
                Picker("", selection: $selectedTab) {
                    Text("Principles").tag(0)
                    Text("Insights").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)
                .padding(.bottom, 16)
                
                TabView(selection: $selectedTab) {
                    PrinciplesListView(pillar: pillar)
                        .tag(0)
                    
                    InsightsListView(pillar: pillar)
                        .tag(1)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut(duration: 0.2), value: selectedTab)
            }
            
            // Focus overlay
            FocusOverlay(isActive: isComposerFocused) {
                isComposerFocused = false
            }
            
            // Floating composer
            VStack {
                Spacer()
                Composer(
                    placeholder: "Ask about \(pillar.name)",
                    text: $inputText,
                    onSend: {
                        // TODO: Handle send
                        inputText = ""
                        isComposerFocused = false
                    },
                    onVoice: {
                        // TODO: Handle voice
                    }
                )
                .focused($isComposerFocused)
            }
        }
        .background(Color.white)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                backButton
            }
            
            ToolbarItem(placement: .topBarTrailing) {
                moreMenu
            }
        }
        .navigationBarBackButtonHidden(true)
        .sheet(isPresented: $showingEditSheet) {
            PillarFormView(mode: .edit(pillar))
                .environmentObject(viewModel)
        }
    }
    
    // MARK: - Toolbar Items
    
    private var backButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "chevron.down")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(pillar.colorValue)
        }
    }
    
    private var moreMenu: some View {
        Menu {
            Button {
                showingEditSheet = true
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            
            Button(role: .destructive) {
                Task {
                    try? await viewModel.deletePillar(pillar)
                }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(pillar.colorValue)
        }
    }
}

#Preview {
    NavigationStack {
        PillarDetailView(pillar: Pillar(
            id: "1",
            userId: "user1",
            name: "Career",
            description: "Professional growth",
            color: "#c6316d",
            icon: .briefcase
        ))
        .environmentObject(PillarsViewModel())
    }
}
