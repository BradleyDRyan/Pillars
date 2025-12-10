//
//  ChatModeView.swift
//  Squirrel2
//
//  Chat mode with its own header, messages, and input
//

import SwiftUI
import MarkdownUI

struct ChatModeView: View {
    @ObservedObject var viewModel: ConversationViewModel
    @Binding var inputText: String
    let onModeSwitch: () -> Void
    let onDismiss: () -> Void
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Chat mode header
            ChatModeHeader(
                onDismiss: onDismiss,
                onModeSwitch: onModeSwitch
            )

            // Chat messages
            ChatMessagesView(viewModel: viewModel)

            Divider()

            // Chat input
            ChatInputBar(
                inputText: $inputText,
                isStreaming: viewModel.isStreaming,
                onSend: sendMessage
            )
        }
    }

    private func sendMessage() {
        let message = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }

        inputText = ""
        viewModel.send(message)
    }
}

// MARK: - Chat Mode Header
struct ChatModeHeader: View {
    let onDismiss: () -> Void
    let onModeSwitch: () -> Void

    var body: some View {
        HStack {
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.squirrelSubheadline)
                    .foregroundColor(.primary)
            }

            Spacer()

            Text("Chat")
                .font(.squirrelHeadline)

            Spacer()

            Button(action: onModeSwitch) {
                Image(systemName: "mic.circle")
                    .font(.squirrelTitle3)
                    .foregroundColor(.blue)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .overlay(
            Divider(),
            alignment: .bottom
        )
    }
}

// MARK: - Chat Messages View
struct ChatMessagesView: View {
    @ObservedObject var viewModel: ConversationViewModel

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(viewModel.messages) { message in
                        ChatMessageBubble(message: message)
                            .id(message.id)
                            .onAppear {
                                print("🗨️ [ChatMessagesView] Displaying message: \(message.role.rawValue) - \(message.content.prefix(30))...")
                            }
                    }
                }
                .padding()
            }
            .onChange(of: viewModel.messages.count) { _, _ in
                if let lastMessage = viewModel.messages.last {
                    withAnimation {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
        }
    }
}

// MARK: - Chat Message Bubble
struct ChatMessageBubble: View {
    let message: ConversationViewModel.Message
    
    // Show typing indicator only when streaming with no content yet
    private var isWaitingForContent: Bool {
        message.isStreaming && message.content.isEmpty
    }

    var body: some View {
        if message.role == .user {
            // User message: bubble aligned right
            HStack {
                Spacer()
                
                if message.type == "photo",
                   !message.attachments.isEmpty,
                   let imageUrl = message.attachments.first,
                   let url = URL(string: imageUrl) {
                    // Show the photo
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxWidth: 250)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    } placeholder: {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.gray.opacity(0.2))
                            .frame(width: 250, height: 200)
                            .overlay(
                                ProgressView()
                            )
                    }
                    .padding(4)
                    .background(
                        RoundedRectangle(cornerRadius: 18)
                            .fill(S2.Colors.secondarySurface)
                    )
                } else {
                    StreamingMarkdownView(
                        content: message.content,
                        isStreaming: message.isStreaming,
                        role: message.role
                    )
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 18)
                            .fill(S2.Colors.secondarySurface)
                    )
                }
            }
        } else {
            // Assistant message: plain text, full width, no bubble (like ChatGPT)
            if isWaitingForContent {
                HStack {
                    ChatTypingIndicator()
                    Spacer()
                }
                .padding(.vertical, 4)
            } else if message.type == "photo",
               !message.attachments.isEmpty,
               let imageUrl = message.attachments.first,
               let url = URL(string: imageUrl) {
                // Show assistant photo without bubble
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: 250)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                } placeholder: {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: 250, height: 200)
                        .overlay(
                            ProgressView()
                        )
                }
            } else {
                StreamingMarkdownView(
                    content: message.content,
                    isStreaming: message.isStreaming,
                    role: message.role
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Chat Typing Indicator
struct ChatTypingIndicator: View {
    @State private var isAnimating = false
    
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.gray)
                    .frame(width: 6, height: 6)
                    .offset(y: isAnimating ? -4 : 0)
                    .animation(
                        .easeInOut(duration: 0.4)
                        .repeatForever(autoreverses: true)
                        .delay(Double(index) * 0.15),
                        value: isAnimating
                    )
            }
        }
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - Chat Input Bar
struct ChatInputBar: View {
    @Binding var inputText: String
    let isStreaming: Bool
    let onSend: () -> Void
    @FocusState private var isInputFocused: Bool

    var body: some View {
        HStack {
            TextField("Type a message...", text: $inputText)
                .font(.squirrelChatInput)
                .textFieldStyle(.roundedBorder)
                .disabled(isStreaming)
                .onSubmit { onSend() }
                .focused($isInputFocused)

            Button(action: onSend) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.squirrelTitle)
                    .foregroundColor(canSend ? .blue : .gray)
            }
            .disabled(!canSend)
        }
        .padding()
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isStreaming
    }
}
