import SwiftUI
import FirebaseAuth

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var showingSignOutAlert = false
    
    var body: some View {
        NavigationView {
            List {
                // User info section
                Section("Account") {
                    HStack {
                        Text("User ID")
                            .foregroundColor(S2.Colors.squirrelTextSecondary)
                        Spacer()
                        Text(firebaseManager.currentUser?.uid ?? "Not signed in")
                            .font(.system(size: 13))
                            .foregroundColor(S2.Colors.squirrelTextPrimary)
                    }
                    
                    if let phoneNumber = firebaseManager.currentUser?.phoneNumber {
                        HStack {
                            Text("Phone")
                                .foregroundColor(S2.Colors.squirrelTextSecondary)
                            Spacer()
                            Text(phoneNumber)
                                .font(.system(size: 13))
                                .foregroundColor(S2.Colors.squirrelTextPrimary)
                        }
                    }
                    
                    if firebaseManager.currentUser?.isAnonymous == true {
                        HStack {
                            Image(systemName: "person.crop.circle.badge.questionmark")
                                .foregroundColor(.orange)
                            Text("Anonymous Account")
                                .font(.system(size: 13))
                                .foregroundColor(S2.Colors.squirrelTextSecondary)
                        }
                    }
                }
                
                // Actions section
                Section {
                    Button(action: {
                        showingSignOutAlert = true
                    }) {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .foregroundColor(.red)
                            Text("Sign Out")
                                .foregroundColor(.red)
                        }
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
                
                // App info section
                Section("About") {
                    HStack {
                        Text("Version")
                            .foregroundColor(S2.Colors.squirrelTextSecondary)
                        Spacer()
                        Text("2.0")
                            .font(.system(size: 13))
                            .foregroundColor(S2.Colors.squirrelTextPrimary)
                    }
                    
                    HStack {
                        Text("Backend")
                            .foregroundColor(S2.Colors.squirrelTextSecondary)
                        Spacer()
                        Text("Connected")
                            .font(.system(size: 13))
                            .foregroundColor(.green)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .alert("Sign Out", isPresented: $showingSignOutAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Sign Out", role: .destructive) {
                Task {
                    do {
                        try firebaseManager.signOut()
                        dismiss()
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
    SettingsView()
        .environmentObject(FirebaseManager.shared)
}
