//
//  TaskViewHeader.swift
//  Squirrel2
//
//  Header component for tasks view with title and action buttons
//

import SwiftUI

struct TaskViewHeader: View {
    @Binding var showingSettings: Bool
    @Binding var showingCreateTask: Bool

    var body: some View {
        HStack {
            S2.Typography.title1("Tasks")
                .foregroundColor(S2.Colors.primaryText)

            Spacer()

            HStack(spacing: 12) {
                // Add task button
                Button(action: {
                    showingCreateTask = true
                }) {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(S2.Colors.primaryBrand)
                }

                // Settings button
                Button(action: {
                    showingSettings = true
                }) {
                    Image(systemName: "gearshape.fill")
                        .foregroundColor(S2.Colors.primaryBrand)
                }
            }
        }
        .padding(S2.Spacing.lg)
    }
}
