//
//  PrincipleRow.swift
//  Pillars
//
//  Single principle row with number, title, and description
//

import SwiftUI

struct PrincipleRow: View {
    let number: Int
    let title: String
    let description: String
    var isFirst: Bool = false
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // Number
            Text(String(format: "%02d.", number))
                .font(.system(size: 17, weight: .regular))
                .foregroundColor(Color.black.opacity(0.3))
                .frame(width: 28, alignment: .leading)
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(.black)
                
                Text(description)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundColor(Color.black.opacity(0.45))
                    .lineSpacing(4)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, isFirst ? 28 : 20)
        .padding(.bottom, 20)
    }
}

#Preview {
    VStack(spacing: 0) {
        PrincipleRow(
            number: 1,
            title: "Words of Affirmation",
            description: "I regularly express my love and gratitude with heartfelt words.",
            isFirst: true
        )
        
        Rectangle()
            .fill(Color(hex: "f3f3f3"))
            .frame(height: 1)
        
        PrincipleRow(
            number: 2,
            title: "Quality Time",
            description: "I prioritize spending focused and meaningful time."
        )
    }
}

