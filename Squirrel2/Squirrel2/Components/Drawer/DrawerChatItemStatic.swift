//
//  DrawerChatItemStatic.swift
//  Squirrel2
//
//  Legacy drawer chat item for static content (backwards compatibility)
//

import SwiftUI

// MARK: - Legacy DrawerChatItem (for static content)
// Keep for backwards compatibility with hardcoded items
struct DrawerChatItemStatic: View {
    let title: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(.system(size: 17, weight: .regular))
                    .lineSpacing(22 - 17)
                    .foregroundColor(S2.Colors.primaryText)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 15)
            .frame(height: 52)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }
}

