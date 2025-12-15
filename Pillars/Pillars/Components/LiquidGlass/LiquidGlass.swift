//
//  LiquidGlass.swift
//  Pillars
//
//  Custom Liquid Glass effect inspired by Linear's implementation
//  Provides controllable blur, gradients, specular highlights, and dynamic lighting
//

import SwiftUI
import UIKit

// MARK: - Glass Configuration

/// Configuration options for the liquid glass effect
struct GlassConfiguration {
    /// Blur radius for the background
    var blurRadius: CGFloat = 20
    
    /// Corner radius of the glass shape
    var cornerRadius: CGFloat = 24
    
    /// Whether to show specular highlights
    var showHighlight: Bool = true
    
    /// Intensity of the specular highlight (0-1, can go higher for HDR)
    var highlightIntensity: CGFloat = 0.8
    
    /// Whether to show the subtle border
    var showBorder: Bool = true
    
    /// Border width
    var borderWidth: CGFloat = 0.5
    
    /// Shadow configuration
    var shadowRadius: CGFloat = 12
    var shadowOpacity: CGFloat = 0.15
    var shadowOffset: CGSize = CGSize(width: 0, height: 4)
    
    /// Tint color for the glass (optional)
    var tintColor: Color? = nil
    var tintOpacity: CGFloat = 0.05
    
    /// Interactive - responds to touch/press
    var interactive: Bool = false
    
    // Presets
    static let regular = GlassConfiguration()
    
    static let subtle = GlassConfiguration(
        blurRadius: 16,
        highlightIntensity: 0.5,
        shadowOpacity: 0.08
    )
    
    static let prominent = GlassConfiguration(
        blurRadius: 24,
        highlightIntensity: 1.0,
        shadowRadius: 16,
        shadowOpacity: 0.2
    )
    
    /// Extra bright HDR glass - maximum glow
    static let hdr = GlassConfiguration(
        blurRadius: 20,
        highlightIntensity: 1.2,
        shadowRadius: 14,
        shadowOpacity: 0.15
    )
    
    static let interactive = GlassConfiguration(
        interactive: true
    )
    
    static let pill = GlassConfiguration(
        cornerRadius: 999
    )
}

// MARK: - Glass Shape

/// A shape that produces a continuous rounded rectangle (squircle) for glass effects
struct GlassShape: Shape {
    var cornerRadius: CGFloat
    
    func path(in rect: CGRect) -> Path {
        Path(roundedRect: rect, cornerRadius: cornerRadius, style: .continuous)
    }
}

// MARK: - Liquid Glass Background View

/// The background blur view using UIVisualEffectView for optimal performance
struct LiquidGlassBackgroundView: UIViewRepresentable {
    let blurRadius: CGFloat
    let tintColor: UIColor?
    let tintOpacity: CGFloat
    
    func makeUIView(context: Context) -> UIVisualEffectView {
        let blurEffect = UIBlurEffect(style: .systemThinMaterial)
        let visualEffectView = UIVisualEffectView(effect: blurEffect)
        
        // Add tint overlay if specified
        if let tint = tintColor {
            let tintView = UIView()
            tintView.backgroundColor = tint.withAlphaComponent(tintOpacity)
            tintView.translatesAutoresizingMaskIntoConstraints = false
            visualEffectView.contentView.addSubview(tintView)
            
            NSLayoutConstraint.activate([
                tintView.topAnchor.constraint(equalTo: visualEffectView.contentView.topAnchor),
                tintView.bottomAnchor.constraint(equalTo: visualEffectView.contentView.bottomAnchor),
                tintView.leadingAnchor.constraint(equalTo: visualEffectView.contentView.leadingAnchor),
                tintView.trailingAnchor.constraint(equalTo: visualEffectView.contentView.trailingAnchor)
            ])
        }
        
        return visualEffectView
    }
    
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {
        // Update tint color if needed
        if let tintView = uiView.contentView.subviews.first {
            tintView.backgroundColor = tintColor?.withAlphaComponent(tintOpacity)
        }
    }
}

// MARK: - Specular Highlight View

/// Calculates and renders HDR-style specular highlights for authentic Liquid Glass appearance
struct SpecularHighlightView: View {
    let cornerRadius: CGFloat
    let intensity: CGFloat
    let lightPosition: CGPoint
    
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        GeometryReader { geometry in
            // Normalize light position to create a gradient angle
            let lightX = lightPosition.x - 0.5
            let lightY = lightPosition.y - 0.5
            
            // HDR multiplier - pushes white beyond normal range for that bright glow
            let hdrBoost: CGFloat = colorScheme == .dark ? 1.5 : 2.0
            
            ZStack {
                // Layer 1: Broad ambient glow (base layer)
                GlassShape(cornerRadius: cornerRadius)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(intensity * 0.5 * hdrBoost),
                                Color.white.opacity(intensity * 0.2 * hdrBoost),
                                Color.white.opacity(intensity * 0.05),
                                Color.clear
                            ],
                            startPoint: UnitPoint(x: 0.5 - lightX * 0.3, y: 0.0),
                            endPoint: UnitPoint(x: 0.5 + lightX * 0.3, y: 0.7)
                        )
                    )
                    .blendMode(.plusLighter)
                
                // Layer 2: Sharp top edge highlight (the key HDR element)
                GlassShape(cornerRadius: cornerRadius)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(intensity * 0.9 * hdrBoost),
                                Color.white.opacity(intensity * 0.6 * hdrBoost),
                                Color.white.opacity(intensity * 0.1),
                                Color.clear
                            ],
                            startPoint: .top,
                            endPoint: UnitPoint(x: 0.5, y: 0.25)
                        )
                    )
                    .blendMode(.plusLighter)
                
                // Layer 3: Rim light on edges
                GlassShape(cornerRadius: cornerRadius)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(intensity * 0.8 * hdrBoost),
                                Color.white.opacity(intensity * 0.3),
                                Color.white.opacity(intensity * 0.1),
                                Color.white.opacity(intensity * 0.2)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 1.5
                    )
                    .blendMode(BlendMode.plusLighter)
                
                // Layer 4: Hot spot - concentrated bright point
                Ellipse()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(intensity * 0.7 * hdrBoost),
                                Color.white.opacity(intensity * 0.3),
                                Color.clear
                            ],
                            center: UnitPoint(x: 0.5 - lightX * 0.2, y: 0.15),
                            startRadius: 0,
                            endRadius: geometry.size.width * 0.4
                        )
                    )
                    .frame(width: geometry.size.width * 0.8, height: geometry.size.height * 0.3)
                    .position(x: geometry.size.width / 2, y: geometry.size.height * 0.2)
                    .blendMode(.plusLighter)
            }
            // Apply brightness boost for HDR effect
            .brightness(colorScheme == .dark ? 0.1 : 0.15)
        }
    }
}

// MARK: - Glass Border View

/// Renders a bright HDR border with inner glow for the glass effect
struct GlassBorderView: View {
    let cornerRadius: CGFloat
    let width: CGFloat
    let lightPosition: CGPoint
    
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.accessibilityReduceTransparency) var reduceTransparency
    
    // Check for increased contrast setting
    private var increaseContrast: Bool {
        UIAccessibility.isDarkerSystemColorsEnabled
    }
    
    var body: some View {
        let hdrBoost: CGFloat = colorScheme == .dark ? 1.2 : 1.8
        let baseBorderOpacity: CGFloat = increaseContrast ? 0.6 : (colorScheme == .dark ? 0.4 : 0.5)
        
        ZStack {
            // Outer bright border
            GlassShape(cornerRadius: cornerRadius)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(baseBorderOpacity * hdrBoost),
                            Color.white.opacity(baseBorderOpacity * 0.7 * hdrBoost),
                            Color.white.opacity(baseBorderOpacity * 0.3),
                            Color.white.opacity(baseBorderOpacity * 0.4)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: increaseContrast ? width * 2 : width
                )
            
            // Inner glow for depth
            GlassShape(cornerRadius: cornerRadius - 1)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.3 * hdrBoost),
                            Color.clear,
                            Color.clear
                        ],
                        startPoint: .top,
                        endPoint: UnitPoint(x: 0.5, y: 0.3)
                    ),
                    lineWidth: 2
                )
                .blendMode(.plusLighter)
                .padding(1)
        }
    }
}

// MARK: - Main Liquid Glass View Modifier

struct LiquidGlassModifier: ViewModifier {
    let configuration: GlassConfiguration
    
    @State private var isPressed = false
    @State private var lightPosition: CGPoint = CGPoint(x: 0.5, y: 0.3)
    @GestureState private var dragOffset: CGSize = .zero
    
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.accessibilityReduceTransparency) var reduceTransparency
    
    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    // 1. Background blur layer
                    if reduceTransparency {
                        // Solid background for accessibility
                        GlassShape(cornerRadius: configuration.cornerRadius)
                            .fill(colorScheme == .dark
                                  ? Color(UIColor.secondarySystemBackground)
                                  : Color(UIColor.systemBackground))
                    } else {
                        LiquidGlassBackgroundView(
                            blurRadius: configuration.blurRadius,
                            tintColor: configuration.tintColor.map { UIColor($0) },
                            tintOpacity: configuration.tintOpacity
                        )
                        .clipShape(GlassShape(cornerRadius: configuration.cornerRadius))
                    }
                    
                    // 2. White glass tint - the key to bright liquid glass
                    GlassShape(cornerRadius: configuration.cornerRadius)
                        .fill(Color.white.opacity(colorScheme == .dark ? 0.08 : 0.5))
                    
                    // 3. Gradient overlay for depth and dimension
                    GlassShape(cornerRadius: configuration.cornerRadius)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(colorScheme == .dark ? 0.15 : 0.6),
                                    Color.white.opacity(colorScheme == .dark ? 0.05 : 0.25),
                                    Color.white.opacity(colorScheme == .dark ? 0.02 : 0.1)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                    
                    // 4. Specular highlight layer (HDR glow)
                    if configuration.showHighlight && !reduceTransparency {
                        SpecularHighlightView(
                            cornerRadius: configuration.cornerRadius,
                            intensity: configuration.highlightIntensity,
                            lightPosition: lightPosition
                        )
                    }
                    
                    // 5. Border layer with inner glow
                    if configuration.showBorder {
                        GlassBorderView(
                            cornerRadius: configuration.cornerRadius,
                            width: configuration.borderWidth,
                            lightPosition: lightPosition
                        )
                    }
                }
            )
            // Shadow
            .shadow(
                color: Color.black.opacity(configuration.shadowOpacity),
                radius: configuration.shadowRadius,
                x: configuration.shadowOffset.width,
                y: configuration.shadowOffset.height
            )
            // Interactive press effect
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
            // Optional gesture for interactive variant
            .if(configuration.interactive) { view in
                view.gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            withAnimation(.easeInOut(duration: 0.1)) {
                                isPressed = true
                            }
                        }
                        .onEnded { _ in
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                                isPressed = false
                            }
                        }
                )
            }
    }
}

// MARK: - Liquid Glass Shape Modifier (for non-rectangular shapes)

struct LiquidGlassShapeModifier<S: Shape>: ViewModifier {
    let shape: S
    let configuration: GlassConfiguration
    
    @State private var isPressed = false
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.accessibilityReduceTransparency) var reduceTransparency
    
    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    // Background blur
                    if reduceTransparency {
                        shape.fill(colorScheme == .dark
                                   ? Color(UIColor.secondarySystemBackground)
                                   : Color(UIColor.systemBackground))
                    } else {
                        LiquidGlassBackgroundView(
                            blurRadius: configuration.blurRadius,
                            tintColor: configuration.tintColor.map { UIColor($0) },
                            tintOpacity: configuration.tintOpacity
                        )
                        .clipShape(shape)
                    }
                    
                    // Gradient overlay
                    shape.fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(colorScheme == .dark ? 0.05 : 0.3),
                                Color.white.opacity(colorScheme == .dark ? 0.02 : 0.1),
                                Color.clear
                            ],
                            startPoint: .top,
                            endPoint: .center
                        )
                    )
                    
                    // Border
                    if configuration.showBorder {
                        shape.stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.3),
                                    Color.white.opacity(0.1),
                                    Color.black.opacity(0.05)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: configuration.borderWidth
                        )
                    }
                }
            )
            .shadow(
                color: Color.black.opacity(configuration.shadowOpacity),
                radius: configuration.shadowRadius,
                x: configuration.shadowOffset.width,
                y: configuration.shadowOffset.height
            )
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
    }
}

// MARK: - View Extensions

extension View {
    /// Applies a custom liquid glass effect with the given configuration
    func liquidGlass(_ configuration: GlassConfiguration = .regular) -> some View {
        modifier(LiquidGlassModifier(configuration: configuration))
    }
    
    /// Applies a custom liquid glass effect with a specific shape
    func liquidGlass<S: Shape>(_ shape: S, configuration: GlassConfiguration = .regular) -> some View {
        modifier(LiquidGlassShapeModifier(shape: shape, configuration: configuration))
    }
    
    /// Interactive glass effect that responds to touch
    func liquidGlassInteractive(_ configuration: GlassConfiguration = .interactive) -> some View {
        modifier(LiquidGlassModifier(configuration: configuration))
    }
    
    /// Conditional modifier helper
    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Liquid Glass Button Style

struct LiquidGlassButtonStyle: ButtonStyle {
    var configuration: GlassConfiguration = .interactive
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .liquidGlass(self.configuration)
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .brightness(configuration.isPressed ? 0.05 : 0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == LiquidGlassButtonStyle {
    static var liquidGlass: LiquidGlassButtonStyle { LiquidGlassButtonStyle() }
    
    static func liquidGlass(_ config: GlassConfiguration) -> LiquidGlassButtonStyle {
        LiquidGlassButtonStyle(configuration: config)
    }
}

// MARK: - Preview

#Preview("Liquid Glass Variants") {
    ZStack {
        // Colorful background to show glass effect
        LinearGradient(
            colors: [.purple, .blue, .cyan, .green],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
        
        VStack(spacing: 24) {
            // Regular glass
            Text("Regular Glass")
                .font(.headline)
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 16)
                .liquidGlass()
            
            // Subtle glass
            Text("Subtle Glass")
                .font(.headline)
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 16)
                .liquidGlass(.subtle)
            
            // Prominent glass
            Text("Prominent Glass")
                .font(.headline)
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 16)
                .liquidGlass(.prominent)
            
            // Pill shape
            Text("Pill Glass")
                .font(.headline)
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .liquidGlass(.pill)
            
            // Tinted glass
            Text("Tinted Glass")
                .font(.headline)
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 16)
                .liquidGlass(GlassConfiguration(
                    tintColor: .orange,
                    tintOpacity: 0.15
                ))
            
            // Button with glass style
            Button(action: {}) {
                Label("Glass Button", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.liquidGlass)
        }
        .padding()
    }
}

#Preview("Glass Card") {
    ZStack {
        Image(systemName: "photo.artframe")
            .resizable()
            .scaledToFill()
            .frame(width: 400, height: 600)
        
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "heart.fill")
                    .font(.title2)
                    .foregroundColor(.red)
                
                Text("Health")
                    .font(.title2.bold())
                    .foregroundColor(.primary)
            }
            
            Text("Your daily wellness companion")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .liquidGlass(GlassConfiguration(
            cornerRadius: 20,
            highlightIntensity: 0.7
        ))
        .padding()
    }
}




