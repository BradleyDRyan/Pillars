//
//  MainTabView.swift
//  Pillars
//
//  Main container with drawer navigation and active view switching
//

import SwiftUI
import FirebaseAuth
import QuartzCore

// MARK: - Manual Animator (bypasses SwiftUI animation system entirely)
class DrawerAnimator: ObservableObject {
    @Published private(set) var offset: CGFloat = 0
    
    private var displayLink: CADisplayLink?
    private var startOffset: CGFloat = 0
    private var targetOffset: CGFloat = 0
    private var startTime: CFTimeInterval = 0
    
    private let duration: CGFloat = 0.22
    
    func setOffset(_ newOffset: CGFloat, animated: Bool) {
        if animated {
            startOffset = offset
            targetOffset = newOffset
            startTime = CACurrentMediaTime()
            startDisplayLink()
        } else {
            targetOffset = newOffset
            offset = newOffset
            stopDisplayLink()
        }
    }
    
    private func startDisplayLink() {
        guard displayLink == nil else {
            startOffset = offset
            startTime = CACurrentMediaTime()
            return
        }
        displayLink = CADisplayLink(target: self, selector: #selector(tick))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    private func stopDisplayLink() {
        displayLink?.invalidate()
        displayLink = nil
    }
    
    @objc private func tick(displayLink: CADisplayLink) {
        let elapsed = CGFloat(CACurrentMediaTime() - startTime)
        let progress = min(elapsed / duration, 1.0)
        let eased = 1 - pow(1 - progress, 3)
        offset = startOffset + (targetOffset - startOffset) * eased
        
        if progress >= 1.0 {
            offset = targetOffset
            stopDisplayLink()
        }
    }
    
    deinit {
        displayLink?.invalidate()
    }
}

// MARK: - Active View
enum ActiveView: Equatable {
    case conversation(Conversation?)
    case newConversation(pillarIds: [String], initialMessage: String)
    case forYou
    case library
    case vibes
}

struct MainTabView: View {
    @State private var activeView: ActiveView = .conversation(nil)
    @State private var isDrawerOpen = false
    @State private var showingSettings = false
    @State private var dragOffset: CGFloat = 0
    
    @StateObject private var drawerAnimator = DrawerAnimator()
    
    private let drawerWidth: CGFloat = 320
    private let animationResponse: Double = 0.3
    
    var body: some View {
        ZStack(alignment: .leading) {
            // Main content
            Color.clear
                .overlay {
                    contentView
                        .environmentObject(FirebaseManager.shared)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.white)
                .offset(x: drawerAnimator.offset + dragOffset)
                .gesture(drawerGesture)
            
            // Scrim overlay
            Color.black
                .opacity(scrimOpacity)
                .ignoresSafeArea()
                .onTapGesture {
                    isDrawerOpen = false
                    drawerAnimator.setOffset(0, animated: true)
                }
                .allowsHitTesting(drawerAnimator.offset > 0 || dragOffset > 0)
            
            // Drawer
            Drawer(
                isDrawerOpen: $isDrawerOpen,
                onChatTapped: {
                    activeView = .conversation(nil)
                },
                onSettingsTapped: {
                    showingSettings = true
                },
                onConversationTapped: { conversation in
                    drawerAnimator.setOffset(0, animated: true)
                    isDrawerOpen = false
                    activeView = .conversation(conversation)
                }
            )
            .frame(width: drawerWidth)
            .offset(x: drawerAnimator.offset - drawerWidth + dragOffset)
        }
        .onChange(of: isDrawerOpen) { _, newValue in
            drawerAnimator.setOffset(newValue ? drawerWidth : 0, animated: true)
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView()
                .environmentObject(FirebaseManager.shared)
        }
    }
    
    // MARK: - Content View
    @ViewBuilder
    private var contentView: some View {
        switch activeView {
        case .conversation(let conversation):
            ConversationView(
                existingConversation: conversation,
                onMenuTapped: toggleDrawer,
                onSettingsTapped: { showingSettings = true },
                showHeader: true
            )
            .id(conversation?.id ?? "new")
            .transition(.identity)
            
        case .newConversation(let pillarIds, let initialMessage):
            ConversationView(
                pillarIds: pillarIds,
                initialMessage: initialMessage,
                onMenuTapped: toggleDrawer,
                onSettingsTapped: { showingSettings = true },
                showHeader: true
            )
            .id("new-\(pillarIds.joined())-\(initialMessage)")
            .transition(.identity)
            
        case .forYou:
            ForYouView(onMenuTapped: toggleDrawer)
            
        case .library:
            LibraryView(onMenuTapped: toggleDrawer)
            
        case .vibes:
            VibesView(onMenuTapped: toggleDrawer)
        }
    }
    
    private var scrimOpacity: Double {
        let maxOpacity: Double = 0.3
        let totalOffset = drawerAnimator.offset + dragOffset
        let progress = max(0, min(1, totalOffset / drawerWidth))
        return maxOpacity * progress
    }
    
    // MARK: - Actions
    private func toggleDrawer() {
        if !isDrawerOpen {
            dismissKeyboard()
        }
        isDrawerOpen.toggle()
        drawerAnimator.setOffset(isDrawerOpen ? drawerWidth : 0, animated: true)
    }
    
    private func dismissKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
    
    // MARK: - Drawer Gesture
    private var drawerGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                let translation = value.translation.width
                if isDrawerOpen {
                    if translation < 0 {
                        dragOffset = translation
                    }
                } else {
                    if translation > 0 && value.startLocation.x < 30 {
                        dragOffset = min(translation, drawerWidth)
                    }
                }
            }
            .onEnded { value in
                let threshold = drawerWidth * 0.3
                
                if isDrawerOpen {
                    if value.translation.width < -threshold || value.predictedEndTranslation.width < -threshold {
                        isDrawerOpen = false
                        drawerAnimator.setOffset(0, animated: true)
                    }
                } else {
                    if dragOffset > threshold || value.predictedEndTranslation.width > threshold {
                        dismissKeyboard()
                        isDrawerOpen = true
                        drawerAnimator.setOffset(drawerWidth, animated: true)
                    }
                }
                
                withAnimation(.spring(response: animationResponse, dampingFraction: 0.8)) {
                    dragOffset = 0
                }
            }
    }
}
