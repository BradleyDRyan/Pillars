//
//  PillarTabBar.swift
//  Pillars
//
//  Custom underline tab bar for pillar detail sections
//

import SwiftUI

struct PillarTabBar: View {
    let tabs: [String]
    @Binding var selectedIndex: Int
    
    @Namespace private var namespace
    
    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(tabs.enumerated()), id: \.offset) { index, title in
                Button {
                    withAnimation(.snappy(duration: 0.25)) {
                        selectedIndex = index
                    }
                } label: {
                    VStack(spacing: S2.Spacing.md) {
                        Text(title)
                            .font(S2.TextStyle.subheadline)
                            .fontWeight(selectedIndex == index ? .semibold : .regular)
                            .foregroundColor(selectedIndex == index ? S2.Colors.primaryText : S2.Colors.secondaryText)
                        
                        // Underline indicator
                        if selectedIndex == index {
                            Rectangle()
                                .fill(S2.Colors.primaryText)
                                .frame(height: 2)
                                .matchedGeometryEffect(id: "underline", in: namespace)
                        } else {
                            Rectangle()
                                .fill(Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, S2.Spacing.xl)
    }
}

#Preview {
    struct PreviewWrapper: View {
        @State private var selectedIndex = 0
        
        var body: some View {
            VStack {
                PillarTabBar(
                    tabs: ["Principles", "Saves"],
                    selectedIndex: $selectedIndex
                )
                
                Spacer()
                
                Text("Selected: \(selectedIndex)")
            }
        }
    }
    
    return PreviewWrapper()
}


