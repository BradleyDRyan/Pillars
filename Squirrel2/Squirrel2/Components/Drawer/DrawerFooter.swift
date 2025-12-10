//
//  DrawerFooter.swift
//  Squirrel2
//
//  Footer component for drawer with compose button
//

import SwiftUI

// MARK: - Drawer Footer
struct DrawerFooter: View {
    let onChatTapped: () -> Void
    
    var body: some View {
        HStack {
            Spacer()
            // Compose button - safeAreaBar handles bottom safe area automatically
            IconButton(icon: "Compose", variant: .primary, size: .medium, action: onChatTapped)
        }
        .padding(.trailing, 24)
        .padding(.bottom, 10)
    }
}

