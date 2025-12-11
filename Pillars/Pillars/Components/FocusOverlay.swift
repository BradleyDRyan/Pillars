//
//  FocusOverlay.swift
//  Pillars
//
//  Reusable blur overlay for composer focus states
//

import SwiftUI

struct FocusOverlay: View {
    let isActive: Bool
    var blurRadius: CGFloat = 8
    var overlayOpacity: CGFloat = 0.7
    var onTap: () -> Void
    
    var body: some View {
        Color.white
            .opacity(isActive ? overlayOpacity : 0)
            .background {
                if isActive {
                    BackdropBlurView(radius: blurRadius)
                }
            }
            .ignoresSafeArea()
            .allowsHitTesting(isActive)
            .onTapGesture {
                onTap()
            }
            .animation(.easeInOut(duration: 0.25), value: isActive)
    }
}

// MARK: - View Extension

extension View {
    /// Adds a focus overlay that blurs the background when active
    func focusOverlay(
        isActive: Bool,
        blurRadius: CGFloat = 8,
        overlayOpacity: CGFloat = 0.7,
        onTap: @escaping () -> Void
    ) -> some View {
        self.overlay {
            FocusOverlay(
                isActive: isActive,
                blurRadius: blurRadius,
                overlayOpacity: overlayOpacity,
                onTap: onTap
            )
        }
    }
}

#Preview {
    ZStack {
        VStack {
            ForEach(0..<5) { _ in
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.blue.opacity(0.3))
                    .frame(height: 80)
            }
        }
        .padding()
        
        FocusOverlay(isActive: true) {
            print("Tapped overlay")
        }
    }
}


