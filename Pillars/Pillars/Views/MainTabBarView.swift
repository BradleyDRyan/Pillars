//
//  MainTabBarView.swift
//  Pillars
//
//  Main tab bar container with Day, Pillars, and Profile tabs
//

import SwiftUI

enum AppTab: Int, CaseIterable {
    case today = 0
    case pillars = 1
    case profile = 2

    var title: String {
        switch self {
        case .today: return "Day"
        case .pillars: return "Pillars"
        case .profile: return "Profile"
        }
    }

    var icon: String {
        switch self {
        case .today: return "calendar"
        case .pillars: return "building.columns.fill"
        case .profile: return "person.fill"
        }
    }
}

struct MainTabBarView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var selectedTab: AppTab = .today
    
    var body: some View {
        TabView(selection: $selectedTab) {
            ActionDayView()
                .environmentObject(firebaseManager)
                .tabItem {
                    Label(AppTab.today.title, systemImage: AppTab.today.icon)
                }
                .tag(AppTab.today)
            
            PillarsTabView()
                .environmentObject(firebaseManager)
                .tabItem {
                    Label(AppTab.pillars.title, systemImage: AppTab.pillars.icon)
                }
                .tag(AppTab.pillars)
            
            ProfileView()
                .environmentObject(firebaseManager)
                .tabItem {
                    Label(AppTab.profile.title, systemImage: AppTab.profile.icon)
                }
                .tag(AppTab.profile)
        }
        .tint(.primary)
    }
}

#Preview {
    MainTabBarView()
        .environmentObject(FirebaseManager.shared)
}
