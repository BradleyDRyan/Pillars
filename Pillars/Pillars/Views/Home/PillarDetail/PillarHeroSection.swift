//
//  PillarHeroSection.swift
//  Pillars
//
//  Hero section displaying pillar icon and name
//

import SwiftUI

struct PillarHeroSection: View {
    let pillar: Pillar
    @EnvironmentObject var viewModel: PillarsViewModel
    
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
        Image(systemName: viewModel.iconSystemName(forToken: pillar.iconToken))
            .font(.system(size: 28, weight: .semibold, design: .rounded))
            .foregroundColor(pillar.colorValue)
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
    .environmentObject(PillarsViewModel())
}
