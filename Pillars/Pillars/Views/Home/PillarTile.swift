//
//  PillarTile.swift
//  Pillars
//
//  A tile displaying a single pillar with icon and title
//

import SwiftUI

struct PillarTile: View {
    let pillar: Pillar
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            pillarIcon
            
            // Title - SF Pro Display Medium, 16px
            Text(pillar.name)
                .font(.system(size: 16, weight: .medium, design: .default))
                .foregroundColor(Color(hex: "555555"))
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(hex: "F3F3F3"))
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }
    
    @ViewBuilder
    private var pillarIcon: some View {
        if let emoji = pillar.emoji, !emoji.isEmpty {
            // Emoji icon
            Text(emoji)
                .font(.system(size: 17))
        } else if let icon = pillar.icon {
            // SF Symbol icon
            Image(systemName: icon.systemName)
                .font(.system(size: 17, weight: .medium))
                .foregroundColor(pillar.colorValue)
        } else {
            // Fallback icon
            Image(systemName: "star.fill")
                .font(.system(size: 17, weight: .medium))
                .foregroundColor(pillar.colorValue)
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        HStack(spacing: 16) {
            PillarTile(pillar: Pillar(
                id: "1",
                userId: "user1",
                name: "Emme",
                color: "#FF6B6B",
                icon: .heart
            ))
            
            PillarTile(pillar: Pillar(
                id: "2",
                userId: "user1",
                name: "Home",
                color: "#4DABF7",
                icon: .house
            ))
        }
        
        HStack(spacing: 16) {
            PillarTile(pillar: Pillar(
                id: "3",
                userId: "user1",
                name: "Career",
                color: "#868E96",
                icon: .briefcase
            ))
            
            PillarTile(pillar: Pillar(
                id: "4",
                userId: "user1",
                name: "Family",
                color: "#CC5DE8",
                icon: .figure2
            ))
        }
        
        HStack(spacing: 16) {
            PillarTile(pillar: Pillar(
                id: "5",
                userId: "user1",
                name: "Finances",
                color: "#51CF66",
                icon: .dollarsign
            ))
            
            Spacer()
        }
    }
    .padding()
    .background(Color(UIColor.secondarySystemBackground))
}

