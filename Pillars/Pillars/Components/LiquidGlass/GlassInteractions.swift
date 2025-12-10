//
//  GlassInteractions.swift
//  Pillars
//
//  Tactile interactions for liquid glass components
//  Lift on press, elastic overscroll, haptic feedback
//

import SwiftUI
import UIKit

// MARK: - Lift Animation Modifier

/// Applies a subtle lift effect when pressed, similar to iOS 26 glass interactions
struct LiftOnPressModifier: ViewModifier {
    let liftAmount: CGFloat
    let scaleAmount: CGFloat
    let shadowIncrease: CGFloat
    
    @State private var isPressed = false
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? scaleAmount : 1.0)
            .offset(y: isPressed ? -liftAmount : 0)
            .shadow(
                color: Color.black.opacity(isPressed ? 0.2 : 0.1),
                radius: isPressed ? 16 : 8,
                y: isPressed ? 8 + liftAmount : 4
            )
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !isPressed {
                            isPressed = true
                            // Haptic feedback
                            let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                            impactFeedback.impactOccurred()
                        }
                    }
                    .onEnded { _ in
                        isPressed = false
                    }
            )
    }
}

// MARK: - Rubber Band Effect

/// Applies elastic rubber band effect to overscroll
struct RubberBandModifier: ViewModifier {
    let maxOffset: CGFloat
    let resistance: CGFloat
    
    @GestureState private var dragOffset: CGSize = .zero
    
    func body(content: Content) -> some View {
        content
            .offset(rubberBandOffset)
            .gesture(
                DragGesture()
                    .updating($dragOffset) { value, state, _ in
                        state = value.translation
                    }
            )
            .animation(.spring(response: 0.4, dampingFraction: 0.7), value: dragOffset)
    }
    
    private var rubberBandOffset: CGSize {
        // Apply rubber band resistance
        let x = rubberBand(dragOffset.width, limit: maxOffset, resistance: resistance)
        let y = rubberBand(dragOffset.height, limit: maxOffset, resistance: resistance)
        return CGSize(width: x, height: y)
    }
    
    private func rubberBand(_ offset: CGFloat, limit: CGFloat, resistance: CGFloat) -> CGFloat {
        let sign: CGFloat = offset < 0 ? -1 : 1
        let absOffset = abs(offset)
        
        if absOffset <= limit {
            return offset
        }
        
        // Rubber band formula: limit + (1 - 1 / (x / limit * resistance + 1)) * limit
        let overflow = absOffset - limit
        let rubberBandedOverflow = (1 - 1 / (overflow / limit * resistance + 1)) * limit * 0.5
        
        return sign * (limit + rubberBandedOverflow)
    }
}

// MARK: - Press Scale Button Style

/// Button style that scales and lifts on press with haptic feedback
struct PressScaleButtonStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    var lift: CGFloat = 2
    var hapticStyle: UIImpactFeedbackGenerator.FeedbackStyle = .light
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1.0)
            .offset(y: configuration.isPressed ? -lift : 0)
            .brightness(configuration.isPressed ? 0.03 : 0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, newValue in
                if newValue {
                    let generator = UIImpactFeedbackGenerator(style: hapticStyle)
                    generator.impactOccurred()
                }
            }
    }
}

// MARK: - Glass Card Style

/// A complete glass card style with lift, highlight, and press states
struct GlassCardStyle: ButtonStyle {
    var cornerRadius: CGFloat = 20
    var highlightIntensity: CGFloat = 0.6
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .liquidGlass(GlassConfiguration(
                cornerRadius: cornerRadius,
                highlightIntensity: highlightIntensity,
                interactive: false
            ))
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .offset(y: configuration.isPressed ? -3 : 0)
            .brightness(configuration.isPressed ? 0.05 : 0)
            .shadow(
                color: Color.black.opacity(configuration.isPressed ? 0.15 : 0.08),
                radius: configuration.isPressed ? 20 : 12,
                y: configuration.isPressed ? 12 : 4
            )
            .animation(.spring(response: 0.3, dampingFraction: 0.65), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, newValue in
                if newValue {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                }
            }
    }
}

// MARK: - Shimmer Effect

/// Adds a subtle shimmer animation to glass surfaces
struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0
    let duration: Double
    
    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0),
                            Color.white.opacity(0.1),
                            Color.white.opacity(0.2),
                            Color.white.opacity(0.1),
                            Color.white.opacity(0)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geometry.size.width * 0.5)
                    .offset(x: -geometry.size.width * 0.5 + (geometry.size.width * 1.5) * phase)
                    .blendMode(.plusLighter)
                }
            )
            .clipped()
            .onAppear {
                withAnimation(.linear(duration: duration).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

// MARK: - View Extensions

extension View {
    /// Applies lift animation on press
    func liftOnPress(
        lift: CGFloat = 4,
        scale: CGFloat = 1.02,
        shadowIncrease: CGFloat = 8
    ) -> some View {
        modifier(LiftOnPressModifier(
            liftAmount: lift,
            scaleAmount: scale,
            shadowIncrease: shadowIncrease
        ))
    }
    
    /// Applies rubber band effect for overscroll
    func rubberBand(
        maxOffset: CGFloat = 50,
        resistance: CGFloat = 0.5
    ) -> some View {
        modifier(RubberBandModifier(maxOffset: maxOffset, resistance: resistance))
    }
    
    /// Adds shimmer animation effect
    func shimmer(duration: Double = 2.0) -> some View {
        modifier(ShimmerModifier(duration: duration))
    }
}

extension ButtonStyle where Self == PressScaleButtonStyle {
    static var pressScale: PressScaleButtonStyle { PressScaleButtonStyle() }
    
    static func pressScale(scale: CGFloat, lift: CGFloat) -> PressScaleButtonStyle {
        PressScaleButtonStyle(scale: scale, lift: lift)
    }
}

extension ButtonStyle where Self == GlassCardStyle {
    static var glassCard: GlassCardStyle { GlassCardStyle() }
    
    static func glassCard(cornerRadius: CGFloat, highlightIntensity: CGFloat = 0.6) -> GlassCardStyle {
        GlassCardStyle(cornerRadius: cornerRadius, highlightIntensity: highlightIntensity)
    }
}

// MARK: - Preview

#Preview("Glass Interactions") {
    ZStack {
        LinearGradient(
            colors: [.indigo, .purple, .pink],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
        
        VStack(spacing: 32) {
            // Lift on press demo
            Text("Lift on Press")
                .font(.headline)
                .foregroundColor(.white)
                .padding(.horizontal, 32)
                .padding(.vertical, 16)
                .liquidGlass()
                .liftOnPress()
            
            // Glass card button
            Button(action: {}) {
                VStack(alignment: .leading, spacing: 8) {
                    Image(systemName: "heart.fill")
                        .font(.title)
                        .foregroundColor(.red)
                    
                    Text("Glass Card")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Text("Tap me!")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.glassCard(cornerRadius: 20))
            .padding(.horizontal, 24)
            
            // Shimmer demo
            Text("Loading...")
                .font(.headline)
                .foregroundColor(.white)
                .padding(.horizontal, 32)
                .padding(.vertical, 16)
                .liquidGlass()
                .shimmer()
        }
    }
}

