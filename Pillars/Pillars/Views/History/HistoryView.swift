//
//  HistoryView.swift
//  Squirrel2
//
//  Shows all conversations the user has had
//

import SwiftUI
import FirebaseAuth

struct HistoryView: View {
    @StateObject private var viewModel = HistoryViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var navigationPath = NavigationPath()
    @State private var selectedConversation: Conversation?
    
    // Navigation callbacks (for drawer integration)
    var onMenuTapped: (() -> Void)?
    var onConversationSelected: ((Conversation) -> Void)?
    
    var body: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                // Custom header with menu button
                HistoryViewHeader(onMenuTapped: onMenuTapped)

                conversationListContent
            }
            .navigationBarHidden(true)
        }
        .fullScreenCover(item: $selectedConversation) { conversation in
            ConversationView(existingConversation: conversation)
                .environmentObject(firebaseManager)
                .onAppear {
                    print("🚀 [HistoryView] ConversationView appeared with: \(conversation.id)")
                }
        }
        .onAppear {
            print("🎯 [HistoryView] View appeared")
            print("🔐 [HistoryView] Current user: \(firebaseManager.currentUser?.uid ?? "nil")")
            if let userId = firebaseManager.currentUser?.uid {
                print("✅ [HistoryView] Starting to listen with userId: \(userId)")
                viewModel.startListening(userId: userId)
            } else {
                print("❌ [HistoryView] No user ID available")
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }

    @ViewBuilder
    private var conversationListContent: some View {
        VStack(spacing: 0) {
            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.conversations.isEmpty {
                EmptyHistoryView()
            } else {
                conversationScrollView
            }
        }
    }

    @ViewBuilder
    private var conversationScrollView: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(Array(viewModel.groupedConversations.keys.sorted(by: >)), id: \.self) { dateKey in
                    conversationSection(for: dateKey)
                }
            }
            .padding(.vertical)
        }
        .scrollEdgeEffectStyle(.soft, for: .top)
    }

    @ViewBuilder
    private func conversationSection(for dateKey: String) -> some View {
        Section {
            ForEach(viewModel.groupedConversations[dateKey] ?? []) { conversation in
                Button(action: {
                    selectConversation(conversation)
                }) {
                    ConversationHistoryRow(conversation: conversation)
                }
                .buttonStyle(PlainButtonStyle())
            }
        } header: {
            sectionHeader(for: dateKey)
        }
    }

    @ViewBuilder
    private func sectionHeader(for dateKey: String) -> some View {
        HStack {
            Text(formatSectionHeader(dateKey))
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .textCase(.uppercase)
            Spacer()
        }
        .padding(.horizontal)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private func selectConversation(_ conversation: Conversation) {
        print("🔵 [HistoryView] User tapped conversation:")
        print("  - ID: \(conversation.id)")
        print("  - Title: \(conversation.title)")
        print("  - Last message: \(conversation.lastMessage ?? "none")")
        selectedConversation = conversation
    }
    
    private func formatSectionHeader(_ dateKey: String) -> String {
        let calendar = Calendar.current
        let date = viewModel.dateFromKey(dateKey)
        
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else if let daysAgo = calendar.dateComponents([.day], from: date, to: Date()).day, daysAgo < 7 {
            return date.formatted(.dateTime.weekday(.wide))
        } else {
            return date.formatted(.dateTime.month(.abbreviated).day())
        }
    }
}

struct ConversationHistoryRow: View {
    let conversation: Conversation
    
    var body: some View {
        HStack(spacing: 12) {
            // Icon based on conversation type
            Image(systemName: conversationIcon)
                .font(.system(size: 24))
                .foregroundColor(S2.Colors.squirrelPrimary)
                .frame(width: 40, height: 40)
                .background(S2.Colors.squirrelPrimary.opacity(0.1))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(conversation.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                
                if let lastMessage = conversation.lastMessage, !lastMessage.isEmpty {
                    Text(lastMessage)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                Text(conversation.updatedAt.formatted(date: .omitted, time: .shortened))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary.opacity(0.5))
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
        .cornerRadius(12)
        .padding(.horizontal)
    }
    
    private var conversationIcon: String {
        if let metadata = conversation.metadata,
           let type = metadata["type"] {
            switch type {
            case "photo":
                return "camera.fill"
            case "voice":
                return "mic.fill"
            case "task":
                return "checklist"
            default:
                return "bubble.left.and.bubble.right.fill"
            }
        }
        return "bubble.left.and.bubble.right.fill"
    }
}

struct EmptyHistoryView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 60))
                .foregroundColor(.gray)
            
            Text("No Conversations Yet")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Your conversation history will appear here")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

