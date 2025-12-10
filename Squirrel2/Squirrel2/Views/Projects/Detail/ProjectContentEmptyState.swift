//
//  ProjectContentEmptyState.swift
//  Squirrel2
//
//  Empty state for project content (chats, bookmarks, files)
//

import SwiftUI

struct ProjectContentEmptyState: View {
    let filter: ProjectFilter
    let projectName: String
    
    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            
            // Icon
            Image(systemName: iconName)
                .font(.system(size: 48))
                .foregroundColor(S2.Colors.tertiaryText)
            
            // Text
            VStack(spacing: 4) {
                Text("No \(filter.rawValue.lowercased()) yet")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(S2.Colors.secondaryText)
                
                Text(subtitle)
                    .font(.system(size: 15))
                    .foregroundColor(S2.Colors.tertiaryText)
                    .multilineTextAlignment(.center)
            }
            
            Spacer()
            Spacer()
        }
        .padding(.horizontal, S2.Spacing.xxl)
    }
    
    private var iconName: String {
        switch filter {
        case .chats:
            return "bubble.left.and.bubble.right"
        case .bookmarks:
            return "bookmark"
        case .files:
            return "doc"
        }
    }
    
    private var subtitle: String {
        switch filter {
        case .chats:
            return "Start a conversation about \(projectName)"
        case .bookmarks:
            return "Save important messages here"
        case .files:
            return "Files shared in conversations will appear here"
        }
    }
}

#Preview {
    VStack {
        ProjectContentEmptyState(filter: .chats, projectName: "Health")
        ProjectContentEmptyState(filter: .bookmarks, projectName: "Health")
    }
}

