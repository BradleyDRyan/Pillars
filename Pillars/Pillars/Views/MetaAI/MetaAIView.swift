//
//  MetaAIView.swift
//  Squirrel2
//
//  Main AI chat interface - the primary conversation view
//

import SwiftUI

struct MetaAIView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    // Navigation callbacks
    var onMenuTapped: (() -> Void)?
    var onSettingsTapped: (() -> Void)?
    
    var body: some View {
        // Reuse ConversationView as the core chat interface
        ConversationView(
            onMenuTapped: onMenuTapped,
            onSettingsTapped: onSettingsTapped,
            showHeader: true
        )
        .environmentObject(firebaseManager)
    }
}

#Preview {
    MetaAIView()
}

