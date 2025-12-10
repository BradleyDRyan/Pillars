//
//  Squirrel2App.swift
//  Squirrel2
//
//  Created by Bradley Ryan on 8/25/25.
//

import SwiftUI
import FirebaseCore

@main
struct Squirrel2App: App {
    @StateObject private var firebaseManager: FirebaseManager
    @StateObject private var locationManager = LocationManager.shared

    init() {
        // Configure Firebase FIRST, before anything else
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        // Now create the FirebaseManager after Firebase is configured
        let manager = FirebaseManager()
        _firebaseManager = StateObject(wrappedValue: manager)

        // Log font availability on app startup
        print("🚀 [FONT DEBUG] App initializing - checking fonts...")
        Font.logAvailableFonts()

        // Kick off any other async setup after Firebase is ready
        Task { @MainActor in
            // Give Firebase a moment to initialize
            try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
            // Request location permissions
            LocationManager.shared.requestPermission()
            
            // Check fonts again after a delay to see if they're loaded
            print("⏰ [FONT DEBUG] Checking fonts again after initialization delay...")
            Font.logAvailableFonts()
        }
    }
    
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(firebaseManager)
        }
    }
}
