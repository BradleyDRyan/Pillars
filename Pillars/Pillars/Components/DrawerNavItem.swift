//
//  DrawerNavItem.swift
//  Squirrel2
//
//  Primary navigation item for the drawer menu
//  Pixel-perfect implementation matching Figma design
//

import SwiftUI

struct DrawerNavItem: View {
    let icon: String
    let title: String
    let isSelected: Bool
    let isSystemIcon: Bool
    let action: () -> Void
    
    init(icon: String, title: String, isSelected: Bool, isSystemIcon: Bool = true, action: @escaping () -> Void) {
        self.icon = icon
        self.title = title
        self.isSelected = isSelected
        self.isSystemIcon = isSystemIcon
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            // Figma: HStack with gap-[10px]
            HStack(spacing: 10) {
                // Icon container - 36x36px
                Group {
                    if isSystemIcon {
                        Image(systemName: icon)
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(S2.Colors.primaryIcon)
                    } else {
                        Image(icon)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 36, height: 36)
                    }
                }
                .frame(width: 36, height: 36)
                
                // Title
                // Figma: text-[17px] leading-[22px] font-medium, color #111112
                Text(title)
                    .font(.optimistic(size: 17, weight: .medium))
                    .lineSpacing(22 - 17) // line-height 22px
                    .foregroundColor(S2.Colors.primaryText)
                
                Spacer()
            }
            // Figma: p-[8px] (8px padding all around)
            .padding(8)
            // Figma: h-[52px]
            .frame(height: 52)
            .frame(maxWidth: .infinity)
            // Figma: rounded-[var(--round,1000px)]
            .background(
                RoundedRectangle(cornerRadius: 1000)
                    .fill(isSelected ? S2.Colors.secondarySurface : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    VStack(spacing: 0) {
        DrawerNavItem(
            icon: "person.2.fill",
            title: "Connections",
            isSelected: true,
            action: {}
        )
        DrawerNavItem(
            icon: "checklist",
            title: "Tasks",
            isSelected: false,
            action: {}
        )
        DrawerNavItem(
            icon: "Meta AI",
            title: "Meta AI",
            isSelected: false,
            isSystemIcon: false,
            action: {}
        )
    }
    .padding()
}
