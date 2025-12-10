//
//  MessagesList.swift
//  Squirrel2
//
//  Reusable messages list component for all chat views
//

import SwiftUI
import MarkdownUI

struct MessagesList: View {
    let messages: [Message]
    let currentUserId: String
    
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    if messages.isEmpty {
                        EmptyMessagesView()
                    } else {
                        ForEach(messages) { message in
                            MessageBubbleView(
                                message: message,
                                isCurrentUser: message.userId == currentUserId
                            )
                            .id(message.id)
                        }
                    }
                }
                .padding()
            }
            .onChange(of: messages.count) { _, _ in
                withAnimation {
                    if let lastMessage = messages.last {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
        }
    }
}

struct MessageBubbleView: View {
    let message: Message
    let isCurrentUser: Bool
    
    var isAssistant: Bool {
        message.userId == "assistant"
    }
    
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isCurrentUser {
                Spacer()
            }
            
            VStack(alignment: isCurrentUser ? .trailing : .leading, spacing: 4) {
                // Handle different message types
                switch message.type {
                case .image:
                    if let imageUrl = message.attachments.first,
                       let url = URL(string: imageUrl) {
                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(maxWidth: 250, maxHeight: 250)
                                .cornerRadius(16)
                        } placeholder: {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.gray.opacity(0.2))
                                .frame(width: 250, height: 250)
                                .overlay(
                                    ProgressView()
                                )
                        }
                    }
                    
                    if !message.content.isEmpty && message.content != "Photo captured" {
                        StreamingMarkdownView(
                            content: message.content,
                            isStreaming: false,
                            role: message.role
                        )
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(bubbleColor)
                        .cornerRadius(18)
                    }
                    
                case .voice:
                    HStack(spacing: 8) {
                        Image(systemName: "waveform")
                            .font(.system(size: 16))
                        Text("Voice message")
                            .font(.system(size: 14))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(bubbleColor)
                    .foregroundColor(textColor)
                    .cornerRadius(18)
                    
                default:
                    StreamingMarkdownView(
                        content: message.content,
                        isStreaming: false,
                        role: message.role
                    )
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(bubbleColor)
                    .cornerRadius(18)
                }
                
                // Timestamp
                Text(message.createdAt.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: 280, alignment: isCurrentUser ? .trailing : .leading)
            
            if !isCurrentUser {
                Spacer()
            }
        }
    }
    
    private var bubbleColor: Color {
        if isCurrentUser {
            return S2.Colors.squirrelPrimary
        } else if isAssistant {
            return Color.secondary.opacity(0.15)
        } else {
            return Color.blue.opacity(0.15)
        }
    }
    
    private var textColor: Color {
        if isCurrentUser {
            return .white
        } else {
            return .primary
        }
    }
}

struct EmptyMessagesView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundColor(.gray.opacity(0.5))
            
            Text("No messages yet")
                .font(.headline)
                .foregroundColor(.secondary)
            
            Text("Start a conversation")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}
