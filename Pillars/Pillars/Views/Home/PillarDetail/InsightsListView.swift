//
//  InsightsListView.swift
//  Pillars
//
//  List of insights for a pillar
//

import SwiftUI

struct InsightsListView: View {
    let pillar: Pillar
    
    var body: some View {
        ScrollView {
            ContentEmptyState(
                icon: "lightbulb",
                title: "No Insights Yet",
                description: "Capture wisdom and reflections here"
            )
            .padding(.bottom, 100) // Space for composer
        }
    }
}

#Preview {
    InsightsListView(pillar: Pillar(
        id: "1",
        userId: "user1",
        name: "Career",
        color: "#868E96",
        icon: .briefcase
    ))
}
