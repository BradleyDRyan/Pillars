//
//  RootView.swift
//  Pillars
//

import SwiftUI

struct RootView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
      
    var body: some View {
        Group {
            if firebaseManager.isAuthenticated {
                // Show main app with tab bar
                MainTabBarView()
                    .environmentObject(firebaseManager)
            } else {
                // Not authenticated - show phone auth
                PhoneAuthView()
            }
        }
    }
}
