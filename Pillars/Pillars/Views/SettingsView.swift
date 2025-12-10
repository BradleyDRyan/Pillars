import SwiftUI
import FirebaseAuth

// MARK: - Navigation Style Setting
enum ProjectNavigationStyle: String, CaseIterable {
    case push = "push"
    case jump = "jump"
    
    var displayName: String {
        switch self {
        case .push: return "Push (with back button)"
        case .jump: return "Jump (direct switch)"
        }
    }
    
    var icon: String {
        switch self {
        case .push: return "arrow.right.circle"
        case .jump: return "bolt.circle"
        }
    }
}

// MARK: - Project Tabs Style Setting
enum ProjectTabsStyle: String, CaseIterable {
    case pills = "pills"
    case segmented = "segmented"
    
    var displayName: String {
        switch self {
        case .pills: return "Pills"
        case .segmented: return "Segmented control"
        }
    }
    
    var icon: String {
        switch self {
        case .pills: return "circle.dotted.circle"
        case .segmented: return "rectangle.split.3x1.fill"
        }
    }
}

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var showingSignOutAlert = false
    
    // Navigation preference
    @AppStorage("settings.projectNavigationStyle") private var projectNavigationStyle = ProjectNavigationStyle.push.rawValue
    // Project tabs style preference
    @AppStorage("settings.projectTabsStyle") private var projectTabsStyle = ProjectTabsStyle.pills.rawValue
    
    var body: some View {
        NavigationView {
            List {
                // Navigation section
                Section {
                    Picker(selection: $projectNavigationStyle) {
                        ForEach(ProjectNavigationStyle.allCases, id: \.rawValue) { style in
                            Label(style.displayName, systemImage: style.icon)
                                .tag(style.rawValue)
                        }
                    } label: {
                        Label("Project Chats", systemImage: "arrow.triangle.branch")
                    }
                    
                    Picker(selection: $projectTabsStyle) {
                        ForEach(ProjectTabsStyle.allCases, id: \.rawValue) { style in
                            Label(style.displayName, systemImage: style.icon)
                                .tag(style.rawValue)
                        }
                    } label: {
                        Label("Project Tabs", systemImage: "rectangle.split.3x1")
                    }
                } header: {
                    Text("Navigation")
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Push shows a back button when opening chats from projects. Jump switches views directly.")
                        Text("Tabs can be shown as pills or a segmented control in project detail.")
                    }
                }
                
                // User info section
                Section("Account") {
                    HStack {
                        Text("User ID")
                            .foregroundColor(S2.Colors.squirrelTextSecondary)
                        Spacer()
                        Text(firebaseManager.currentUser?.uid ?? "Not signed in")
                            .font(.squirrelFootnote)
                            .foregroundColor(S2.Colors.squirrelTextPrimary)
                    }
                    
                    if let phoneNumber = firebaseManager.currentUser?.phoneNumber {
                        HStack {
                            Text("Phone")
                                .foregroundColor(S2.Colors.squirrelTextSecondary)
                            Spacer()
                            Text(phoneNumber)
                                .font(.squirrelFootnote)
                                .foregroundColor(S2.Colors.squirrelTextPrimary)
                        }
                    }
                    
                    if firebaseManager.currentUser?.isAnonymous == true {
                        HStack {
                            Image(systemName: "person.crop.circle.badge.questionmark")
                                .foregroundColor(.orange)
                            Text("Anonymous Account")
                                .font(.squirrelFootnote)
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
                            .font(.squirrelFootnote)
                            .foregroundColor(S2.Colors.squirrelTextPrimary)
                    }
                    
                    HStack {
                        Text("Backend")
                            .foregroundColor(S2.Colors.squirrelTextSecondary)
                        Spacer()
                        Text("Connected")
                            .font(.squirrelFootnote)
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
