//
//  ContentEmptyState.swift
//  Pillars
//
//  Reusable empty state view for content sections
//

import SwiftUI

struct ContentEmptyState: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 40, weight: .light))
                .foregroundColor(Color.black.opacity(0.2))
            
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.black)
            
            Text(description)
                .font(.system(size: 15, weight: .regular))
                .foregroundColor(Color.black.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}

#Preview {
    ContentEmptyState(
        icon: "lightbulb",
        title: "No Items Yet",
        description: "Add something to get started"
    )
}
