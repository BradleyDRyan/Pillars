//
//  DrawerSectionHeader.swift
//  Squirrel2
//
//  Section header component for drawer menu sections
//  Pixel-perfect implementation matching Figma design
//

import SwiftUI

struct DrawerSectionHeader: View {
    let title: String
    
    var body: some View {
        HStack {
            // Figma: text-[16px] leading-[26px] font-regular
            // color: rgba(0,4,9,0.59) - secondary text
            Text(title)
                .font(.squirrelCallout)
                .lineSpacing(26 - 16) // line-height 26px
                .foregroundColor(S2.Colors.secondaryText)
            
            Spacer()
        }
        // Figma: px-[12px] py-[6px]
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        // Figma: Total height 38px (26px line-height + 6px top + 6px bottom = 38px)
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 0) {
        DrawerSectionHeader(title: "Features")
        DrawerSectionHeader(title: "Chats")
    }
    .padding()
}

