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
                if firebaseManager.isCheckingOnboardingStatus {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Loading...")
                            .font(.system(size: 15))
                            .foregroundColor(.secondary)
                    }
                } else if firebaseManager.hasCompletedOnboarding {
                    // Show main app with tab bar
                    MainTabBarView()
                        .environmentObject(firebaseManager)
                } else {
                    // Show onboarding flow
                    OnboardingContainerView()
                        .environmentObject(firebaseManager)
                }
            } else {
                // Not authenticated - show phone auth
                PhoneAuthView()
            }
        }
    }
}
