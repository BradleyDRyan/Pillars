//
//  MainTabBarView.swift
//  Pillars
//
//  Main tab bar container with Today, Pillars, and Profile tabs
//

import SwiftUI

enum AppTab: Int, CaseIterable {
    case today = 0
    case pillars = 1
    case coach = 2
    case profile = 3
    
    var title: String {
        switch self {
        case .today: return "Today"
        case .pillars: return "Pillars"
        case .coach: return "Coach"
        case .profile: return "Profile"
        }
    }
    
    var icon: String {
        switch self {
        case .today: return "sun.max.fill"
        case .pillars: return "building.columns.fill"
        case .coach: return "sparkles"
        case .profile: return "person.fill"
        }
    }
}

struct MainTabBarView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var selectedTab: AppTab = .pillars
    
    var body: some View {
        TabView(selection: $selectedTab) {
            TodayView()
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
            
            CoachView()
                .environmentObject(firebaseManager)
                .tabItem {
                    Label(AppTab.coach.title, systemImage: AppTab.coach.icon)
                }
                .tag(AppTab.coach)
            
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
