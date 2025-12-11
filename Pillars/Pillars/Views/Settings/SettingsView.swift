//
//  SettingsView.swift
//  Pillars
//
//  App settings and preferences
//

import SwiftUI
import FirebaseAuth

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    var body: some View {
        NavigationStack {
            List {
                // Account Section
                Section("Account") {
                    if let user = Auth.auth().currentUser {
                        HStack {
                            Text("Email")
                            Spacer()
                            Text(user.email ?? "Not set")
                                .foregroundColor(.secondary)
                        }
                        
                        HStack {
                            Text("Phone")
                            Spacer()
                            Text(user.phoneNumber ?? "Not set")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                // App Info Section
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(AppConfig.appVersion)
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Build")
                        Spacer()
                        Text(AppConfig.buildNumber)
                            .foregroundColor(.secondary)
                    }
                }
                
                // Actions Section
                Section {
                    Button(role: .destructive) {
                        signOut()
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func signOut() {
        do {
            try Auth.auth().signOut()
            try firebaseManager.signOut()
            dismiss()
        } catch {
            print("Error signing out: \(error.localizedDescription)")
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(FirebaseManager.shared)
}
