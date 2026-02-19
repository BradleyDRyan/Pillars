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
                    VStack(spacing: 10) {
                        Text(title)
                            .font(.system(size: 15, weight: selectedIndex == index ? .semibold : .regular))
                            .foregroundColor(selectedIndex == index ? Color(UIColor.label) : Color(UIColor.label).opacity(0.5))
                        
                        // Underline indicator
                        if selectedIndex == index {
                            Rectangle()
                                .fill(Color.primary)
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
        .padding(.horizontal, 20)
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



