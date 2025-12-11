//
//  CoachView.swift
//  Pillars
//
//  Coach tab - AI coaching conversations
//

import SwiftUI

struct CoachView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Hero section
                    heroSection
                    
                    // Conversation starters
                    conversationStartersSection
                    
                    // Recent conversations
                    recentConversationsSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 32)
            }
            .background(Color(UIColor.systemBackground))
            .navigationTitle("Coach")
            .navigationBarTitleDisplayMode(.large)
        }
    }
    
    // MARK: - Hero Section
    private var heroSection: some View {
        VStack(spacing: 16) {
            // Coach avatar
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.purple, .blue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 80, height: 80)
                .overlay {
                    Image(systemName: "sparkles")
                        .font(.system(size: 32))
                        .foregroundColor(.white)
                }
            
            VStack(spacing: 8) {
                Text("Your Personal Coach")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.primary)
                
                Text("I'm here to help you grow and stay aligned with your pillars")
                    .font(.system(size: 15))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
        }
        .padding(.vertical, 24)
    }
    
    // MARK: - Conversation Starters Section
    private var conversationStartersSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Start a Conversation")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.primary)
            
            VStack(spacing: 12) {
                ConversationStarterCard(
                    icon: "brain.head.profile",
                    title: "Reflect on my day",
                    subtitle: "Process thoughts and experiences",
                    color: .purple
                )
                
                ConversationStarterCard(
                    icon: "target",
                    title: "Work on a goal",
                    subtitle: "Break down and plan next steps",
                    color: .orange
                )
                
                ConversationStarterCard(
                    icon: "heart.circle",
                    title: "Check in on my pillars",
                    subtitle: "Review alignment and progress",
                    color: .pink
                )
                
                ConversationStarterCard(
                    icon: "lightbulb",
                    title: "Get advice",
                    subtitle: "Talk through a challenge",
                    color: .yellow
                )
            }
        }
    }
    
    // MARK: - Recent Conversations Section
    private var recentConversationsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Recent Conversations")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.primary)
            
            // Empty state
            VStack(spacing: 12) {
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 32))
                    .foregroundColor(.secondary.opacity(0.5))
                
                Text("No conversations yet")
                    .font(.system(size: 15))
                    .foregroundColor(.secondary)
                
                Text("Start a conversation above to get coaching")
                    .font(.system(size: 13))
                    .foregroundColor(.secondary.opacity(0.8))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 32)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(16)
        }
    }
}

// MARK: - Conversation Starter Card
struct ConversationStarterCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundColor(color)
                .frame(width: 48, height: 48)
                .background(color.opacity(0.15))
                .cornerRadius(12)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
                
                Text(subtitle)
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.secondary)
        }
        .padding(16)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(16)
    }
}

#Preview {
    CoachView()
        .environmentObject(FirebaseManager.shared)
}
