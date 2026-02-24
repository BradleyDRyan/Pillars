//
//  PillarDetailView.swift
//  Pillars
//
//  Detail view for a single pillar with paginated tabs
//

import SwiftUI

struct PillarDetailView: View {
    let pillar: Pillar
    @EnvironmentObject var viewModel: PillarsViewModel
    @State private var showingEditSheet = false
    @State private var selectedTab: Int? = 0
    @State private var scrollOffset: CGFloat = 0

    private let tabs = ["Principles", "Saves", "Points", "Rubric", "Context"]
    
    private let heroMaxHeight: CGFloat = 88
    
    // When to start fading in the toolbar title
    private let titleFadeStart: CGFloat = 66
    // How much additional scroll to fully fade in (after start)
    private let titleFadeDistance: CGFloat = 30
    
    private var heroHeight: CGFloat {
        max(0, heroMaxHeight - scrollOffset)
    }
    
    // Progress for hero scale (based on full height)
    private var heroScaleProgress: CGFloat {
        min(1, max(0, scrollOffset / heroMaxHeight))
    }
    
    // Progress for hero opacity (slower fade)
    private var heroFadeProgress: CGFloat {
        min(1, max(0, scrollOffset / 80))
    }
    
    // Progress for toolbar title (delayed start at 44)
    private var collapseProgress: CGFloat {
        let adjustedOffset = scrollOffset - titleFadeStart
        return min(1, max(0, adjustedOffset / titleFadeDistance))
    }

    private var livePillar: Pillar {
        viewModel.pillars.first(where: { $0.id == pillar.id }) ?? pillar
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Hero that shrinks, scales, and moves up based on scroll
            PillarHeroSection(pillar: livePillar)
                .scaleEffect(1 - (heroScaleProgress * 0.1))
                .offset(y: -scrollOffset * 0.5)
                .frame(height: heroHeight)
                .opacity(1 - heroFadeProgress)
            
            // Tab bar (always visible)
            PillarTabBar(
                tabs: tabs,
                selectedIndex: Binding(
                    get: { selectedTab ?? 0 },
                    set: { selectedTab = $0 }
                )
            )
            .padding(.vertical, 8)
            .background(Color.white)
            
            // Horizontally paging tabs - each with its own scroll
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 0) {
                    TabContentScrollView(offset: selectedTab == 0 ? $scrollOffset : .constant(0)) {
                        PrinciplesContentView(pillar: livePillar)
                    }
                    .containerRelativeFrame(.horizontal)
                    .id(0)
                    
                    TabContentScrollView(offset: selectedTab == 1 ? $scrollOffset : .constant(0)) {
                        SavesContentView(pillar: livePillar)
                    }
                    .containerRelativeFrame(.horizontal)
                    .id(1)

                    TabContentScrollView(offset: selectedTab == 2 ? $scrollOffset : .constant(0)) {
                        PointsContentView(pillar: livePillar)
                    }
                    .containerRelativeFrame(.horizontal)
                    .id(2)

                    TabContentScrollView(offset: selectedTab == 3 ? $scrollOffset : .constant(0)) {
                        RubricContentView(pillar: livePillar)
                    }
                    .containerRelativeFrame(.horizontal)
                    .id(3)

                    TabContentScrollView(offset: selectedTab == 4 ? $scrollOffset : .constant(0)) {
                        ContextContentView(pillar: livePillar)
                    }
                    .containerRelativeFrame(.horizontal)
                    .id(4)
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $selectedTab)
        }
        .background(Color.white)
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                // Title fades in as hero collapses
                Text(livePillar.name)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(.primary)
                    .opacity(collapseProgress)
            }
            
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    editButton
                    deleteMenu
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            NavigationStack {
                PillarFormView(mode: .edit(livePillar))
                    .environmentObject(viewModel)
            }
        }
    }
    
    // MARK: - Toolbar Items
    
    private var editButton: some View {
        Button {
            showingEditSheet = true
        } label: {
            Image(systemName: "pencil")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(livePillar.colorValue)
        }
        .buttonStyle(.plain)
    }

    private var deleteMenu: some View {
        Menu {
            Button(role: .destructive) {
                Task {
                    try? await viewModel.deletePillar(livePillar)
                }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(livePillar.colorValue)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Tab Content ScrollView

struct TabContentScrollView<Content: View>: View {
    @Binding var offset: CGFloat
    @ViewBuilder let content: Content
    
    var body: some View {
        ScrollView {
            content
        }
        .onScrollGeometryChange(for: CGFloat.self) { geo in
            geo.contentOffset.y
        } action: { _, newValue in
            offset = max(0, newValue)
        }
    }
}

#Preview {
    NavigationStack {
        PillarDetailView(
            pillar: Pillar(
                id: "1",
                userId: "user1",
                name: "Career",
                description: "Professional growth",
                color: "#c6316d",
                icon: .briefcase
            )
        )
        .environmentObject(PillarsViewModel())
        .environmentObject(FirebaseManager.shared)
    }
}
