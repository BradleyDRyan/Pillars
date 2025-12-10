//
//  ActivityItem.swift
//  Squirrel2
//
//  Container component for displaying a conversation in the activity list
//

import SwiftUI

struct ActivityItem: View {
    let conversation: Conversation

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header with time and location
            ActivityItemHeader(conversation: conversation)

            // Content with icon, title, and message
            ActivityItemContent(conversation: conversation)
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
        .cornerRadius(12)
        .padding(.horizontal)
    }
}