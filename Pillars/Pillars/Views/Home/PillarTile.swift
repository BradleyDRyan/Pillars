//
//  PillarTile.swift
//  Pillars
//
//  A tile displaying a single pillar with icon and title
//  Uses custom Liquid Glass effect for modern iOS 26 aesthetic
//

import SwiftUI

struct PillarTile: View {
    let pillar: Pillar
    var namespace: Namespace.ID?
    
    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            // Icon with matched transition source
            if let namespace = namespace {
                pillarIcon
                    .matchedTransitionSource(id: "pillar-\(pillar.id)", in: namespace)
            } else {
                pillarIcon
            }
            
            // Title
            Text(pillar.name)
                .font(.squirrelHeadline)
                .foregroundColor(S2.Colors.primaryText)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .tunedGlass(cornerRadius: 16)
    }
    
    @ViewBuilder
    private var pillarIcon: some View {
        let iconSize: CGFloat = 36
        
        if let emoji = pillar.emoji, !emoji.isEmpty {
            // Emoji icon
            Text(emoji)
                .font(.system(size: iconSize * 0.5))
                .frame(width: iconSize, height: iconSize)
                .background(
                    Circle()
                        .fill(pillar.colorValue.opacity(0.15))
                )
        } else if let icon = pillar.icon {
            // SF Symbol icon
            Image(systemName: icon.systemName)
                .font(.system(size: iconSize * 0.4, weight: .semibold))
                .foregroundColor(pillar.colorValue)
                .frame(width: iconSize, height: iconSize)
                .background(
                    Circle()
                        .fill(pillar.colorValue.opacity(0.15))
                )
        } else {
            // Fallback icon
            Image(systemName: "star.fill")
                .font(.system(size: iconSize * 0.4, weight: .semibold))
                .foregroundColor(pillar.colorValue)
                .frame(width: iconSize, height: iconSize)
                .background(
                    Circle()
                        .fill(pillar.colorValue.opacity(0.15))
                )
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

