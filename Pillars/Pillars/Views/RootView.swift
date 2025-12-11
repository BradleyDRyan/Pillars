//
//  RootView.swift
//  Pillars
//

import SwiftUI
import FirebaseAuth

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
        // Required for Firebase phone auth reCAPTCHA callback handling in SwiftUI lifecycle.
        .onOpenURL { url in
            _ = Auth.auth().canHandle(url)
        }
    }
}
