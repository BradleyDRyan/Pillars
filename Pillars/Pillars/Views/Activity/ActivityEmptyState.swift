//
//  ActivityEmptyState.swift
//  Squirrel2
//
//  Empty state view for when there are no conversations to display
//

import SwiftUI

struct ActivityEmptyState: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text("No Activity Yet")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Your conversation history will appear here")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}