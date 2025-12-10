//
//  ForYouView.swift
//  Squirrel2
//
//  Personalized suggestions and recommendations
//

import SwiftUI

struct ForYouView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    // Navigation callbacks
    var onMenuTapped: (() -> Void)?
    
    // Sample suggestions data
    private let suggestions = [
        ForYouSuggestion(icon: "sparkles", title: "Daily Summary", subtitle: "Get a personalized recap of your day"),
        ForYouSuggestion(icon: "lightbulb.fill", title: "Smart Suggestions", subtitle: "AI-powered recommendations just for you"),
        ForYouSuggestion(icon: "heart.fill", title: "Wellness Check", subtitle: "How are you feeling today?"),
        ForYouSuggestion(icon: "calendar", title: "Upcoming Events", subtitle: "What's on your calendar"),
    ]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            ForYouHeader(onMenuTapped: onMenuTapped)
            
            // Content
            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    // Welcome section
                    welcomeSection
                    
                    // Suggestions grid
                    suggestionsSection
                    
                    // Quick actions
                    quickActionsSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 100)
            }
            .scrollEdgeEffectStyle(.soft, for: .top)
        }
        .background(Color.white)
    }
    
    // MARK: - Welcome Section
    private var welcomeSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Good \(timeOfDay)")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(S2.Colors.primaryText)
            
            Text("Here's what's happening for you today")
                .font(.system(size: 15))
                .foregroundColor(S2.Colors.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    // MARK: - Suggestions Section
    private var suggestionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Suggested for you")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(S2.Colors.primaryText)
            
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                ForEach(suggestions) { suggestion in
                    SuggestionCard(suggestion: suggestion)
                }
            }
        }
    }
    
    // MARK: - Quick Actions Section
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick actions")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(S2.Colors.primaryText)
            
            VStack(spacing: 8) {
                QuickActionRow(icon: "mic.fill", title: "Voice chat", subtitle: "Talk to Meta AI")
                QuickActionRow(icon: "camera.fill", title: "Snap & ask", subtitle: "Get answers about images")
                QuickActionRow(icon: "text.bubble.fill", title: "New chat", subtitle: "Start a conversation")
            }
        }
    }
    
    private var timeOfDay: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "morning"
        case 12..<17: return "afternoon"
        default: return "evening"
        }
    }
}

// MARK: - ForYou Header
struct ForYouHeader: View {
    var onMenuTapped: (() -> Void)?
    
    var body: some View {
        HStack {
            if let onMenuTapped = onMenuTapped {
                IconButton(icon: "Menu", action: onMenuTapped)
            }
            
            Spacer()
            
            Text("For You")
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

// MARK: - Suggestion Model
struct ForYouSuggestion: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let subtitle: String
}

// MARK: - Suggestion Card
struct SuggestionCard: View {
    let suggestion: ForYouSuggestion
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: suggestion.icon)
                .font(.system(size: 24))
                .foregroundColor(.black)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(suggestion.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(S2.Colors.primaryText)
                
                Text(suggestion.subtitle)
                    .font(.system(size: 13))
                    .foregroundColor(S2.Colors.secondaryText)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(S2.Colors.secondarySurface)
        .cornerRadius(16)
    }
}

// MARK: - Quick Action Row
struct QuickActionRow: View {
    let icon: String
    let title: String
    let subtitle: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(.black)
                .frame(width: 40, height: 40)
                .background(S2.Colors.secondarySurface)
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
            
            Image(systemName: "chevron.right")
                .font(.system(size: 14))
                .foregroundColor(S2.Colors.tertiaryText)
        }
        .padding(12)
        .background(S2.Colors.secondarySurface)
        .cornerRadius(12)
    }
}

#Preview {
    ForYouView()
}

