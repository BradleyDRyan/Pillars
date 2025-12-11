//
//  PillarHeroSection.swift
//  Pillars
//
//  Hero section displaying pillar icon and name
//

import SwiftUI

struct PillarHeroSection: View {
    let pillar: Pillar
    
    var body: some View {
        VStack(spacing: 6) {
            // Icon
            pillarIcon
            
            // Title
            Text(pillar.name)
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(pillar.colorValue)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.vertical, 8)
    }
    
    @ViewBuilder
    private var pillarIcon: some View {
        if let emoji = pillar.emoji, !emoji.isEmpty {
            Text(emoji)
                .font(.system(size: 28))
        } else if let icon = pillar.icon {
            Image(systemName: icon.systemName)
                .font(.system(size: 28, weight: .semibold, design: .rounded))
                .foregroundColor(pillar.colorValue)
        } else {
            Image(systemName: "star.fill")
                .font(.system(size: 28, weight: .semibold, design: .rounded))
                .foregroundColor(pillar.colorValue)
        }
    }
}

#Preview {
    PillarHeroSection(pillar: Pillar(
        id: "1",
        userId: "user1",
        name: "Career",
        color: "#c6316d",
        icon: .briefcase
    ))
}

