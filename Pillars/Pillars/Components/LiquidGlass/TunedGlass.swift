//
//  TunedGlass.swift
//  Pillars
//
//  Tuned Liquid Glass effect based on playground calibration
//  Matches Apple's native glassEffect appearance
//

import SwiftUI

// MARK: - Tuned Glass Background

struct TunedGlassBackground: View {
    let cornerRadius: CGFloat
    
    // Tuned values from GlassPlayground
    private let baseOpacity: CGFloat = 0.70
    private let gradientTop: CGFloat = 0.29
    private let gradientBottom: CGFloat = 0.0
    private let hdrBoost: CGFloat = 0.05
    private let borderTopLeft: CGFloat = 1.0
    private let borderTopRight: CGFloat = 0.20
    private let borderBottomRight: CGFloat = 1.0
    private let borderBottomLeft: CGFloat = 0.20
    private let borderWidth: CGFloat = 0.9
    private let borderHDR: CGFloat = 0.03
    
    // Pre-compute gradient stops
    private var borderGradientStops: [Gradient.Stop] {
        let topCenter = (borderTopLeft + borderTopRight) / 2
        let rightCenter = (borderTopRight + borderBottomRight) / 2
        let bottomCenter = (borderBottomRight + borderBottomLeft) / 2
        let leftCenter = (borderBottomLeft + borderTopLeft) / 2
        
        return [
            Gradient.Stop(color: Color.white.opacity(topCenter), location: 0.0),
            Gradient.Stop(color: Color.white.opacity(borderTopRight), location: 0.125),
            Gradient.Stop(color: Color.white.opacity(rightCenter), location: 0.25),
            Gradient.Stop(color: Color.white.opacity(borderBottomRight), location: 0.375),
            Gradient.Stop(color: Color.white.opacity(bottomCenter), location: 0.5),
            Gradient.Stop(color: Color.white.opacity(borderBottomLeft), location: 0.625),
            Gradient.Stop(color: Color.white.opacity(leftCenter), location: 0.75),
            Gradient.Stop(color: Color.white.opacity(borderTopLeft), location: 0.875),
            Gradient.Stop(color: Color.white.opacity(topCenter), location: 1.0)
        ]
    }
    
    var body: some View {
        ZStack {
            // Layer 1: Full white base
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(Color.white.opacity(baseOpacity))
            
            // Layer 2: Top-to-bottom gradient for depth
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(gradientTop),
                            Color.white.opacity(gradientBottom)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            
            // Layer 3: 4-corner gradient border
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(
                    AngularGradient(
                        stops: borderGradientStops,
                        center: .center,
                        startAngle: .degrees(-90),
                        endAngle: .degrees(270)
                    ),
                    lineWidth: borderWidth
                )
                .brightness(borderHDR)
        }
        .brightness(hdrBoost)
    }
}

// MARK: - View Modifier

struct TunedGlassModifier: ViewModifier {
    let cornerRadius: CGFloat
    
    func body(content: Content) -> some View {
        content
            .background(TunedGlassBackground(cornerRadius: cornerRadius))
            // Figma dual-layer shadow
            .shadow(color: Color.black.opacity(0.03), radius: 6, x: 0, y: 2)
            .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 1)
    }
}

// MARK: - View Extension

extension View {
    /// Applies the tuned liquid glass effect (calibrated to match Apple's glassEffect)
    func tunedGlass(cornerRadius: CGFloat = 12.0) -> some View {
        modifier(TunedGlassModifier(cornerRadius: cornerRadius))
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        LinearGradient(
            colors: [.purple, .blue, .cyan],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
        
        VStack(spacing: 20) {
            // Custom tuned glass
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "heart.fill")
                    .font(.title2)
                    .foregroundColor(.red)
                
                Text("Tuned Glass")
                    .font(.headline)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tunedGlass(cornerRadius: 20)
            
            // Apple's native glass for comparison
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "heart.fill")
                    .font(.title2)
                    .foregroundColor(.red)
                
                Text("Apple Glass")
                    .font(.headline)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 20))
        }
        .padding()
    }
}


