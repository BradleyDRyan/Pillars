//
//  PrinciplesListView.swift
//  Pillars
//
//  List of principles for a pillar
//

import SwiftUI

struct PrinciplesListView: View {
    let pillar: Pillar
    
    // TODO: Replace with real data from ViewModel
    private let samplePrinciples = [
        ("Words of Affirmation", "I regularly express my love and gratitude with heartfelt words that affirm her importance in my life."),
        ("Quality Time", "I prioritize spending focused and meaningful time with Emme."),
        ("Physical Touch", "I maintain a warm physical connection through consistent affectionate touch."),
        ("Receiving Gifts", "I prioritize spending focused and meaningful time with Emme.")
    ]
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(samplePrinciples.enumerated()), id: \.offset) { index, principle in
                    PrincipleRow(
                        number: index + 1,
                        title: principle.0,
                        description: principle.1,
                        isFirst: index == 0
                    )
                    
                    if index < samplePrinciples.count - 1 {
                        Divider()
                            .background(Color(hex: "f3f3f3"))
                    }
                }
            }
        }
    }
}

#Preview {
    PrinciplesListView(pillar: Pillar(
        id: "1",
        userId: "user1",
        name: "Emme",
        color: "#c6316d",
        icon: .heart
    ))
}

