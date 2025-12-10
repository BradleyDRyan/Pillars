//
//  ProjectsEmptyState.swift
//  Squirrel2
//
//  Empty state view when user has no projects
//

import SwiftUI

struct ProjectsEmptyState: View {
    let onCreateTapped: () -> Void
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            // Icon
            ZStack {
                Circle()
                    .fill(S2.Colors.secondarySurface)
                    .frame(width: 80, height: 80)
                
                Image(systemName: "folder.badge.plus")
                    .font(.system(size: 32))
                    .foregroundColor(S2.Colors.secondaryText)
            }
            
            // Text
            VStack(spacing: 8) {
                Text("No Projects Yet")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(S2.Colors.primaryText)
                
                Text("Create a project to organize your\nconversations, tasks, and notes")
                    .font(.system(size: 15))
                    .foregroundColor(S2.Colors.secondaryText)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
            
            // Create button
            Button(action: onCreateTapped) {
                HStack(spacing: 8) {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .semibold))
                    Text("Create Project")
                        .font(.system(size: 16, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
                .background(Color.black)
                .cornerRadius(24)
            }
            
            Spacer()
            Spacer()
        }
        .padding(.horizontal, S2.Spacing.xxl)
    }
}

#Preview {
    ProjectsEmptyState(onCreateTapped: {})
}

