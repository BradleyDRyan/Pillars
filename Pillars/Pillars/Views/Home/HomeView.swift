//
//  HomeView.swift
//  Pillars
//
//  Main home view displaying pillars grid and composer
//

import SwiftUI
import FirebaseAuth

struct HomeView: View {
    @StateObject private var viewModel = PillarsViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var showingAddPillar = false
    @State private var showingSettings = false
    @State private var selectedPillar: Pillar?
    
    // Conversation navigation
    @State private var showConversation = false
    @State private var initialMessage: String = ""
    @State private var inputText: String = ""
    
    // Zoom transition namespace
    @Namespace private var namespace
    
    // Composer focus state
    @FocusState private var isComposerFocused: Bool
    
    private let columns = [
        GridItem(.flexible(), spacing: S2.Spacing.md),
        GridItem(.flexible(), spacing: S2.Spacing.md)
    ]
    
    // Dynamic placeholder based on context
    private var composerPlaceholder: String {
        if let pillar = selectedPillar {
            return "Ask about \(pillar.name)"
        }
        return "Ask Meta AI"
    }
    
    var body: some View {
        ZStack {
            NavigationStack {
                ZStack {
                    // Background
                    Color(UIColor.systemBackground)
                        .ignoresSafeArea()
                    
                    VStack(spacing: 0) {
                        // Pillars Grid
                        ScrollView {
                            LazyVGrid(columns: columns, spacing: S2.Spacing.md) {
                                ForEach(viewModel.pillars) { pillar in
                                    Button {
                                        withAnimation(.snappy(duration: 0.15)) {
                                            selectedPillar = pillar
                                        }
                                    } label: {
                                        PillarTile(pillar: pillar)
                                    }
                                    .buttonStyle(.pressScale)
                                }
                            }
                            .padding(.horizontal, S2.Spacing.lg)
                            .padding(.top, S2.Spacing.md)
                            .padding(.bottom, 100) // Space for composer
                        }
                        
                        Spacer(minLength: 0)
                    }
                    
                    // Focus overlay when composer is active
                    FocusOverlay(isActive: isComposerFocused) {
                        isComposerFocused = false
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            showingSettings = true
                        } label: {
                            Image(systemName: "line.3.horizontal")
                        }
                    }
                    
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
                .sheet(isPresented: $showingSettings) {
                    SettingsView()
                }
                .navigationDestination(item: $selectedPillar) { pillar in
                    PillarDetailView(pillar: pillar)
                        .environmentObject(viewModel)
                }
                .navigationDestination(isPresented: $showConversation) {
                    ConversationView(
                        pillarIds: selectedPillar != nil ? [selectedPillar!.id] : [],
                        initialMessage: initialMessage,
                        showHeader: false
                    )
                    .navigationBarBackButtonHidden(false)
                    .environmentObject(firebaseManager)
                }
            }
            
            // Floating Composer (outside NavigationStack so it persists across navigation)
            if !showConversation {
                VStack {
                    Spacer()
                    Composer(
                        placeholder: composerPlaceholder,
                        text: $inputText,
                        onSend: {
                            let message = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !message.isEmpty else { return }
                            
                            // Log conversation creation context
                            if let pillar = selectedPillar {
                                print("🏛️ [HomeView] Starting conversation FROM PILLAR: '\(pillar.name)' (id: \(pillar.id))")
                            } else {
                                print("🏛️ [HomeView] Starting conversation WITHOUT pillar context")
                            }
                            
                            // Dismiss keyboard for clean transition
                            isComposerFocused = false
                            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                            
                            initialMessage = message
                            inputText = ""
                            withAnimation(.snappy(duration: 0.15)) {
                                showConversation = true
                            }
                        },
                        onVoice: {
                            // TODO: Launch voice mode
                        }
                    )
                    .focused($isComposerFocused)
                    .matchedGeometryEffect(id: "composer", in: namespace)
                    .animation(.snappy(duration: 0.3), value: selectedPillar?.id)
                }
            }
        }
        .onAppear {
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId)
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }
}

#Preview {
    HomeView()
        .environmentObject(FirebaseManager.shared)
}
