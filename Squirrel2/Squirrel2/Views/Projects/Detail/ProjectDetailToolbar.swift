//
//  ProjectDetailToolbar.swift
//  Squirrel2
//
//  Toolbar with menu and ellipsis buttons for project detail view
//

import SwiftUI

struct ProjectDetailToolbar: View {
    let onMenuTapped: () -> Void
    let onMoreTapped: () -> Void
    
    var body: some View {
        HStack {
            // Menu/Back button
            IconButton(icon: "Menu", action: onMenuTapped)
            
            Spacer()
            
            // More options button
            IconButton(icon: "ThreeDot", action: onMoreTapped)
        }
        // Match ConversationHeader: 20px horizontal, 8px bottom
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }
}

#Preview {
    ProjectDetailToolbar(
        onMenuTapped: {},
        onMoreTapped: {}
    )
}

