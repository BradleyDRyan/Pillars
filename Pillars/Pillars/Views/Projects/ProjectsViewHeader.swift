//
//  ProjectsViewHeader.swift
//  Squirrel2
//
//  Header component for the Projects list view
//

import SwiftUI

struct ProjectsViewHeader: View {
    var onMenuTapped: (() -> Void)?
    var onCreateTapped: (() -> Void)?
    
    var body: some View {
        HStack(spacing: 16) {
            // Menu button
            if let onMenuTapped = onMenuTapped {
                IconButton(icon: "Menu", action: onMenuTapped)
            }
            
            Spacer()
            
            // Title
            Text("Projects")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(S2.Colors.primaryText)
            
            Spacer()
            
            // Create button
            if let onCreateTapped = onCreateTapped {
                IconButton(icon: "plus", isSystemIcon: true, action: onCreateTapped)
            } else {
                // Balance spacer
                Color.clear.frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
        .padding(.vertical, S2.Spacing.sm)
    }
}

#Preview {
    ProjectsViewHeader(
        onMenuTapped: {},
        onCreateTapped: {}
    )
}

