//
//  PillarsApp.swift
//  Pillars
//

import SwiftUI
import FirebaseCore
import FirebaseAuth

@main
struct PillarsApp: App {
    // AppDelegate handles Firebase configuration and push notification setup
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var firebaseManager = FirebaseManager()
    @StateObject private var locationManager = LocationManager.shared

    init() {
        // Log font availability on app startup
        print("🚀 [FONT DEBUG] App initializing...")
        Font.logAvailableFonts()

        // Request location permissions
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 100_000_000)
            LocationManager.shared.requestPermission()
        }
    }
    
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(firebaseManager)
                .onOpenURL { url in
                    print("📱 onOpenURL: \(url)")
                    Auth.auth().canHandle(url)
                }
        }
    }
}
