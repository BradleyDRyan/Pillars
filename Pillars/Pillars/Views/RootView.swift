//
//  RootView.swift
//  Squirrel2
//

import SwiftUI

struct RootView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @StateObject private var authService = AuthService.shared
    @State private var isSigningIn = false
      
    var body: some View {
        Group {
            if isSigningIn {
                // Loading state
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("Setting up your account...")
                        .font(.squirrelCallout)
                        .foregroundColor(S2.Colors.squirrelTextSecondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(S2.Colors.squirrelBackground)
            } else if firebaseManager.isAuthenticated {
                // Show main app
                HomeView()
                    .environmentObject(firebaseManager)
            } else {
                // Not authenticated - auto sign in
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("Preparing your experience...")
                        .font(.squirrelCallout)
                        .foregroundColor(S2.Colors.squirrelTextSecondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(S2.Colors.squirrelBackground)
                .onAppear {
                    // Automatically sign in anonymously if not authenticated
                    if !firebaseManager.isAuthenticated && !isSigningIn {
                        Task {
                            isSigningIn = true
                            do {
                                try await authService.signInAnonymously()
                                
                                // Wait for FirebaseManager's auth state to be updated
                                var retries = 0
                                while firebaseManager.currentUser == nil && retries < 20 {
                                    try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
                                    retries += 1
                                }
                                
                                if firebaseManager.currentUser != nil {
                                    print("✅ User authenticated: \(firebaseManager.currentUser!.uid)")
                                }
                            } catch {
                                print("❌ Failed to sign in: \(error)")
                            }
                            isSigningIn = false
                        }
                    }
                }
            }
        }
    }
}
