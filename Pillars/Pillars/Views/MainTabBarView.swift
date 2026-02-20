//
//  MainTabBarView.swift
//  Pillars
//
//  Main tab bar container with My Day, Todo, Habits, Pillars, and Profile tabs
//

import SwiftUI

enum AppTab: Int, CaseIterable {
    case today = 0
    case todo = 1
    case habits = 2
    case pillars = 3
    case profile = 4

    var title: String {
        switch self {
        case .today: return "Day"
        case .todo: return "Todo"
        case .habits: return "Habits"
        case .pillars: return "Pillars"
        case .profile: return "Profile"
        }
    }

    var icon: String {
        switch self {
        case .today: return "calendar"
        case .todo: return "checkmark.circle"
        case .habits: return "heart.text.square"
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
            DayView()
                .environmentObject(firebaseManager)
                .tabItem {
                    Label(AppTab.today.title, systemImage: AppTab.today.icon)
                }
                .tag(AppTab.today)

            TodoView()
                .environmentObject(firebaseManager)
                .tabItem {
                    Label(AppTab.todo.title, systemImage: AppTab.todo.icon)
                }
                .tag(AppTab.todo)

            HabitView()
                .environmentObject(firebaseManager)
                .tabItem {
                    Label(AppTab.habits.title, systemImage: AppTab.habits.icon)
                }
                .tag(AppTab.habits)
            
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
