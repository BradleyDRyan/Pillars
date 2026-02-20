//
//  PillarTagChip.swift
//  Pillars
//
//  Reusable badge for showing an assigned pillar.
//

import SwiftUI

struct PillarTagChip: View {
    let title: String
    let color: Color

    var body: some View {
        Text(title)
            .font(S2.MyDay.Typography.fieldLabel)
            .foregroundColor(color)
            .padding(.horizontal, S2.Spacing.sm)
            .padding(.vertical, S2.Spacing.xs)
            .background(color.opacity(0.14))
            .clipShape(Capsule())
    }
}
