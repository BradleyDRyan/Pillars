//
//  ActivityItemContent.swift
//  Squirrel2
//
//  Content component for ActivityItem displaying title and last message
//

import SwiftUI

struct ActivityItemContent: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 12) {
            // Icon based on conversation type
            Image(systemName: conversationIcon)
                .font(.system(size: 24))
                .foregroundColor(S2.Colors.primaryBrand)
                .frame(width: 40, height: 40)
                .background(S2.Colors.primaryBrand.opacity(0.1))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                // Title
                Text(conversation.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                // Last message preview
                if let lastMessage = conversation.lastMessage, !lastMessage.isEmpty {
                    Text(lastMessage)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }

            Spacer()

            // Chevron indicator
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary.opacity(0.5))
        }
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