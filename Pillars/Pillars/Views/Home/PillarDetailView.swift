//
//  PillarDetailView.swift
//  Pillars
//
//  Detail view for a single pillar showing its principles, wisdom, and resources
//

import SwiftUI

struct PillarDetailView: View {
    let pillar: Pillar
    @EnvironmentObject var viewModel: PillarsViewModel
    @State private var showingEditSheet = false
    @State private var selectedTab = 0
    
    var body: some View {
        ScrollView {
            VStack(spacing: S2.Spacing.xl) {
                // Header
                pillarHeader
                
                // Stats
                statsRow
                
                // Content tabs
                Picker("Content", selection: $selectedTab) {
                    Text("Principles").tag(0)
                    Text("Wisdom").tag(1)
                    Text("Resources").tag(2)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, S2.Spacing.lg)
                
                // Content based on selected tab
                switch selectedTab {
                case 0:
                    principlesSection
                case 1:
                    wisdomSection
                case 2:
                    resourcesSection
                default:
                    EmptyView()
                }
            }
            .padding(.vertical, S2.Spacing.lg)
            .padding(.bottom, 80) // Space for shared composer from HomeView
        }
        .background(Color(UIColor.systemBackground))
        .navigationTitle(pillar.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
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
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(S2.Colors.primaryIcon)
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            PillarFormView(mode: .edit(pillar))
                .environmentObject(viewModel)
        }
    }
    
    // MARK: - Header
    
    @ViewBuilder
    private var pillarHeader: some View {
        VStack(spacing: S2.Spacing.md) {
            // Icon
            if let emoji = pillar.emoji, !emoji.isEmpty {
                Text(emoji)
                    .font(.system(size: 48))
            } else if let icon = pillar.icon {
                Image(systemName: icon.systemName)
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(pillar.colorValue)
                    .frame(width: 64, height: 64)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(pillar.colorValue.opacity(0.15))
                    )
            }
            
            // Description
            if !pillar.description.isEmpty {
                Text(pillar.description)
                    .font(.squirrelBody)
                    .foregroundColor(S2.Colors.secondaryText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, S2.Spacing.xl)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, S2.Spacing.lg)
    }
    
    // MARK: - Stats
    
    @ViewBuilder
    private var statsRow: some View {
        HStack(spacing: S2.Spacing.xl) {
            statItem(count: pillar.stats.principleCount, label: "Principles")
            statItem(count: pillar.stats.wisdomCount, label: "Wisdom")
            statItem(count: pillar.stats.resourceCount, label: "Resources")
        }
        .padding(.horizontal, S2.Spacing.lg)
    }
    
    @ViewBuilder
    private func statItem(count: Int, label: String) -> some View {
        VStack(spacing: S2.Spacing.xs) {
            Text("\(count)")
                .font(.squirrelTitle2)
                .foregroundColor(S2.Colors.primaryText)
            Text(label)
                .font(.squirrelCaption)
                .foregroundColor(S2.Colors.secondaryText)
        }
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - Content Sections
    
    @ViewBuilder
    private var principlesSection: some View {
        VStack(spacing: S2.Spacing.md) {
            if pillar.stats.principleCount == 0 {
                emptyState(
                    icon: "lightbulb",
                    title: "No Principles Yet",
                    description: "Add guiding beliefs for this pillar"
                )
            } else {
                // TODO: List principles
                Text("Principles list coming soon")
                    .foregroundColor(S2.Colors.secondaryText)
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
    }
    
    @ViewBuilder
    private var wisdomSection: some View {
        VStack(spacing: S2.Spacing.md) {
            if pillar.stats.wisdomCount == 0 {
                emptyState(
                    icon: "brain.head.profile",
                    title: "No Wisdom Yet",
                    description: "Capture lessons and reflections here"
                )
            } else {
                // TODO: List wisdom
                Text("Wisdom list coming soon")
                    .foregroundColor(S2.Colors.secondaryText)
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
    }
    
    @ViewBuilder
    private var resourcesSection: some View {
        VStack(spacing: S2.Spacing.md) {
            if pillar.stats.resourceCount == 0 {
                emptyState(
                    icon: "book",
                    title: "No Resources Yet",
                    description: "Save books, articles, and frameworks"
                )
            } else {
                // TODO: List resources
                Text("Resources list coming soon")
                    .foregroundColor(S2.Colors.secondaryText)
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
    }
    
    @ViewBuilder
    private func emptyState(icon: String, title: String, description: String) -> some View {
        VStack(spacing: S2.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 40, weight: .light))
                .foregroundColor(S2.Colors.tertiaryIcon)
            
            Text(title)
                .font(.squirrelHeadline)
                .foregroundColor(S2.Colors.primaryText)
            
            Text(description)
                .font(.squirrelSubheadline)
                .foregroundColor(S2.Colors.secondaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, S2.Spacing.xxxl)
    }
}

#Preview {
    NavigationStack {
        PillarDetailView(pillar: Pillar(
            id: "1",
            userId: "user1",
            name: "Career",
            description: "Professional growth and work-life balance",
            color: "#868E96",
            icon: .briefcase
        ))
        .environmentObject(PillarsViewModel())
    }
}
