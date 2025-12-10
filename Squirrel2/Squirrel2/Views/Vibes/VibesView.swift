//
//  VibesView.swift
//  Squirrel2
//
//  Vibes view - mood-based AI interactions and themes
//

import SwiftUI

struct VibesView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    // Navigation callbacks
    var onMenuTapped: (() -> Void)?
    
    @State private var selectedVibe: Vibe?
    
    private let vibes: [Vibe] = [
        Vibe(name: "Focused", icon: "brain.head.profile", color: .blue, description: "Deep work mode"),
        Vibe(name: "Creative", icon: "paintpalette.fill", color: .purple, description: "Unleash imagination"),
        Vibe(name: "Calm", icon: "leaf.fill", color: .green, description: "Peaceful & relaxed"),
        Vibe(name: "Energized", icon: "bolt.fill", color: .orange, description: "Ready to conquer"),
        Vibe(name: "Social", icon: "person.2.fill", color: .pink, description: "Connect with others"),
        Vibe(name: "Curious", icon: "magnifyingglass", color: .teal, description: "Learn & explore"),
    ]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            VibesHeader(onMenuTapped: onMenuTapped)
            
            ScrollView(showsIndicators: false) {
                VStack(spacing: 32) {
                    // Current mood section
                    currentMoodSection
                    
                    // Vibes grid
                    vibesGridSection
                    
                    // Suggested activities
                    suggestedActivitiesSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 100)
            }
            .scrollEdgeEffectStyle(.soft, for: .top)
        }
        .background(Color.white)
    }
    
    // MARK: - Current Mood Section
    private var currentMoodSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("How are you feeling?")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(S2.Colors.primaryText)
            
            Text("Select a vibe to personalize your experience")
                .font(.system(size: 15))
                .foregroundColor(S2.Colors.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    // MARK: - Vibes Grid Section
    private var vibesGridSection: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12)
        ], spacing: 12) {
            ForEach(vibes) { vibe in
                VibeCard(
                    vibe: vibe,
                    isSelected: selectedVibe?.id == vibe.id
                ) {
                    withAnimation(.spring(response: 0.3)) {
                        selectedVibe = vibe
                    }
                }
            }
        }
    }
    
    // MARK: - Suggested Activities Section
    private var suggestedActivitiesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Try these")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(S2.Colors.primaryText)
            
            VStack(spacing: 8) {
                ActivityRow(
                    icon: "waveform",
                    title: "Guided meditation",
                    subtitle: "5 min • Calm your mind"
                )
                ActivityRow(
                    icon: "music.note",
                    title: "Focus playlist",
                    subtitle: "Curated for deep work"
                )
                ActivityRow(
                    icon: "text.quote",
                    title: "Daily affirmation",
                    subtitle: "Start your day right"
                )
            }
        }
    }
}

// MARK: - Vibes Header
struct VibesHeader: View {
    var onMenuTapped: (() -> Void)?
    
    var body: some View {
        HStack {
            if let onMenuTapped = onMenuTapped {
                IconButton(icon: "Menu", action: onMenuTapped)
            }
            
            Spacer()
            
            Text("Vibes")
                .font(.system(size: 17, weight: .semibold))
            
            Spacer()
            
            if onMenuTapped != nil {
                Color.clear.frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

// MARK: - Vibe Model
struct Vibe: Identifiable {
    let id = UUID()
    let name: String
    let icon: String
    let color: Color
    let description: String
}

// MARK: - Vibe Card
struct VibeCard: View {
    let vibe: Vibe
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                // Icon
                Image(systemName: vibe.icon)
                    .font(.system(size: 28))
                    .foregroundColor(isSelected ? .white : vibe.color)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(vibe.name)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(isSelected ? .white : S2.Colors.primaryText)
                    
                    Text(vibe.description)
                        .font(.system(size: 13))
                        .foregroundColor(isSelected ? .white.opacity(0.8) : S2.Colors.secondaryText)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(isSelected ? vibe.color : S2.Colors.secondarySurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? vibe.color : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Activity Row
struct ActivityRow: View {
    let icon: String
    let title: String
    let subtitle: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(.purple)
                .frame(width: 44, height: 44)
                .background(Color.purple.opacity(0.1))
                .cornerRadius(12)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(S2.Colors.primaryText)
                
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundColor(S2.Colors.secondaryText)
            }
            
            Spacer()
            
            Image(systemName: "play.circle.fill")
                .font(.system(size: 28))
                .foregroundColor(.purple)
        }
        .padding(12)
        .background(S2.Colors.secondarySurface)
        .cornerRadius(12)
    }
}

#Preview {
    VibesView()
}

