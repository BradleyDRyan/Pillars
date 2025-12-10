//
//  DrawerHeader.swift
//  Squirrel2
//
//  Header component for drawer
//

import SwiftUI

// MARK: - Drawer Header
struct DrawerHeader: View {
    let onAvatarTapped: () -> Void
    let onMenuTapped: () -> Void
    
    var body: some View {
        HStack {
            // User avatar - using AvatarButton, sized to match IconButton height
            AvatarButton(imageName: "profile-pic", size: 44, action: onAvatarTapped)
            
            Spacer()
            
            // Three-dot menu button - using IconButton
            IconButton(icon: "ThreeDot", action: onMenuTapped)
        }
        // Align with nav item icons (12px body + 8px item padding = 20px)
        .padding(.horizontal, 20)
        // safeAreaBar handles top safe area automatically
        .padding(.bottom, 8)
    }
}

