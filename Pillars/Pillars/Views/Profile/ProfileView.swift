//
//  ProfileView.swift
//  Pillars
//
//  Profile tab - user settings and account info
//

import SwiftUI
import FirebaseAuth

struct ProfileView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var showingSignOutAlert = false
    
    var body: some View {
        NavigationStack {
            List {
                // Profile header section
                Section {
                    HStack(spacing: 16) {
                        // Avatar
                        Circle()
                            .fill(Color.blue.opacity(0.2))
                            .frame(width: 64, height: 64)
                            .overlay {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 28))
                                    .foregroundColor(.blue)
                            }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            if firebaseManager.currentUser?.isAnonymous == true {
                                Text("Guest User")
                                    .font(.system(size: 18, weight: .semibold))
                                Text("Anonymous Account")
                                    .font(.system(size: 14))
                                    .foregroundColor(.secondary)
                            } else if let phoneNumber = firebaseManager.currentUser?.phoneNumber {
                                Text(phoneNumber)
                                    .font(.system(size: 18, weight: .semibold))
                                Text("Phone Account")
                                    .font(.system(size: 14))
                                    .foregroundColor(.secondary)
                            } else {
                                Text("User")
                                    .font(.system(size: 18, weight: .semibold))
                            }
                        }
                        
                        Spacer()
                    }
                    .padding(.vertical, 8)
                }
                
                // Account section
                Section("Account") {
                    HStack {
                        Label("User ID", systemImage: "person.text.rectangle")
                        Spacer()
                        Text(firebaseManager.currentUser?.uid.prefix(8) ?? "—")
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                    
                    if firebaseManager.currentUser?.isAnonymous == true {
                        HStack {
                            Label("Account Type", systemImage: "person.crop.circle.badge.questionmark")
                            Spacer()
                            Text("Anonymous")
                                .font(.system(size: 13))
                                .foregroundColor(.orange)
                        }
                    }
                }
                
                // Preferences section
                Section("Preferences") {
                    NavigationLink {
                        Text("Notifications Settings")
                    } label: {
                        Label("Notifications", systemImage: "bell.badge")
                    }
                    
                    NavigationLink {
                        Text("Appearance Settings")
                    } label: {
                        Label("Appearance", systemImage: "paintbrush")
                    }
                    
                    NavigationLink {
                        Text("Privacy Settings")
                    } label: {
                        Label("Privacy", systemImage: "lock.shield")
                    }
                }
                
                // Debug section
                #if DEBUG
                Section("Developer") {
                    NavigationLink {
                        GlassPlayground()
                    } label: {
                        Label("Glass Playground", systemImage: "slider.horizontal.3")
                    }
                }
                #endif
                
                // About section
                Section("About") {
                    HStack {
                        Label("Version", systemImage: "info.circle")
                        Spacer()
                        Text("2.0")
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Label("Backend", systemImage: "server.rack")
                        Spacer()
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 8, height: 8)
                            Text("Connected")
                                .font(.system(size: 13))
                                .foregroundColor(.green)
                        }
                    }
                }
                
                // Sign out section
                Section {
                    Button(role: .destructive) {
                        showingSignOutAlert = true
                    } label: {
                        HStack {
                            Spacer()
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
        }
        .alert("Sign Out", isPresented: $showingSignOutAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Sign Out", role: .destructive) {
                Task {
                    do {
                        try firebaseManager.signOut()
                    } catch {
                        print("Error signing out: \(error)")
                    }
                }
            }
        } message: {
            Text("Are you sure you want to sign out? Your anonymous account data may be lost.")
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject(FirebaseManager.shared)
}

