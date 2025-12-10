//
//  TaskEmptyState.swift
//  Squirrel2
//
//  Empty state view when no tasks exist
//

import SwiftUI

struct TaskEmptyState: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 32))
                .foregroundColor(S2.Colors.tertiaryIcon)

            Text("No tasks yet")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(S2.Colors.tertiaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 40)
        .padding(.bottom, 50)
    }
}
