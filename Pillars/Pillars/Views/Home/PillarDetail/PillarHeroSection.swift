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
        VStack(spacing: 12) {
            // Icon - 40px
            pillarIcon
            
            // Title - 32px, pillar color
            Text(pillar.name)
                .font(.system(size: 32, weight: .medium))
                .foregroundColor(pillar.colorValue)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 20)
        .padding(.bottom, 40)
    }
    
    @ViewBuilder
    private var pillarIcon: some View {
        if let emoji = pillar.emoji, !emoji.isEmpty {
            Text(emoji)
                .font(.system(size: 40))
        } else if let icon = pillar.icon {
            Image(systemName: icon.systemName)
                .font(.system(size: 40, weight: .semibold, design: .rounded))
                .foregroundColor(pillar.colorValue)
        } else {
            Image(systemName: "star.fill")
                .font(.system(size: 40, weight: .semibold, design: .rounded))
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

