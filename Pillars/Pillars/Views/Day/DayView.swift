//
//  DayView.swift
//  Pillars
//
//  Shell for the Day screen.
//  This file keeps only top-level screen state and the main body layout.
//  Supporting logic lives in Screen, Entries, Features, and Blocks folders.
//

import SwiftUI

/// Day screen entry point.
struct DayView: View {
    // Current signed-in user information.
    @EnvironmentObject var firebaseManager: FirebaseManager

    // Main Day data and block types.
    @StateObject var viewModel = DayViewModel()
    @StateObject var pillarPickerSource = PillarPickerDataSource()

    // Which section should receive a new block.
    @State private var addBlockSection: DaySection.TimeSection?

    // Tracks which user already has live updates running.
    @State var loadedUserId: String?

    // Date currently shown on screen.
    @State var selectedDate = Calendar.current.startOfDay(for: Date())

    // Sheet targets for pillar assignment.
    @State var pillarPickerTarget: PillarPickerTarget?

    // Keeps entry move animations smooth between sections.
    @Namespace var completionCardNamespace

    /// Main screen flow.
    var body: some View {
        return NavigationStack {
            Group {
                // Show loading, content, or error.
                if viewModel.isLoading {
                    ProgressView("Loading your day…")
                        .font(S2.MyDay.Typography.helper)
                        .tint(S2.Colors.primaryBrand)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let day = viewModel.day {
                    dayEntriesContent(day: day)
                } else {
                    errorState
                }
            }
            .background(dayCardVisualStyle.dayViewBackground.color.ignoresSafeArea())
            .environment(\.dayCardVisualStyle, dayCardVisualStyle)
        }
        .task(id: firebaseManager.currentUser?.uid) {
            handleUserContextChange()
        }
        .onChange(of: selectedDate) { _, newValue in
            reloadDay(for: newValue)
        }
        .sheet(item: $addBlockSection, content: addBlockSheetContent)
        .sheet(item: $pillarPickerTarget, content: pillarPickerSheetContent)
    }
}

#Preview {
    DayView()
        .environmentObject(FirebaseManager.shared)
}
