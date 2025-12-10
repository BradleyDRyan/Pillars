//
//  GlassPlayground.swift
//  Pillars
//
//  UI Playground to tune custom Liquid Glass effect by comparing to Apple's native glassEffect
//

import SwiftUI

struct GlassPlayground: View {
    // Glass configuration - tuned defaults
    @State private var cornerRadius: CGFloat = 20.0
    @State private var baseOpacity: CGFloat = 0.70
    @State private var gradientTop: CGFloat = 0.29
    @State private var gradientBottom: CGFloat = 0.0
    @State private var hdrBoost: CGFloat = 0.05
    @State private var borderTopLeft: CGFloat = 1.0
    @State private var borderTopRight: CGFloat = 0.20
    @State private var borderBottomRight: CGFloat = 1.0
    @State private var borderBottomLeft: CGFloat = 0.20
    @State private var borderWidth: CGFloat = 0.9
    @State private var borderHDR: CGFloat = 0.03
    @State private var shadowRadius: CGFloat = 8.0
    @State private var shadowOpacity: CGFloat = 0.04
    @State private var showBorder: Bool = true
    
    // Background selection
    @State private var backgroundIndex: Int = 0
    private let backgrounds: [AnyView] = [
        AnyView(LinearGradient(colors: [.purple, .blue, .cyan], startPoint: .topLeading, endPoint: .bottomTrailing)),
        AnyView(LinearGradient(colors: [.orange, .pink, .red], startPoint: .topLeading, endPoint: .bottomTrailing)),
        AnyView(LinearGradient(colors: [.green, .teal, .blue], startPoint: .topLeading, endPoint: .bottomTrailing)),
        AnyView(Color(UIColor.systemBackground)),
        AnyView(Color(UIColor.secondarySystemBackground)),
        AnyView(Image(systemName: "photo.artframe").resizable().scaledToFill().foregroundColor(.gray.opacity(0.3)))
    ]
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                backgrounds[backgroundIndex]
                    .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        // Comparison tiles
                        HStack(spacing: 16) {
                            // Our custom glass
                            VStack(alignment: .leading, spacing: 8) {
                                Image(systemName: "heart.fill")
                                    .font(.title2)
                                    .foregroundColor(.red)
                                    .padding(8)
                                    .background(Color.red.opacity(0.15))
                                    .cornerRadius(8)
                                
                                Text("Custom")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(
                                CustomGlassBackground(
                                    cornerRadius: cornerRadius,
                                    baseOpacity: baseOpacity,
                                    gradientTop: gradientTop,
                                    gradientBottom: gradientBottom,
                                    hdrBoost: hdrBoost,
                                    borderTopLeft: borderTopLeft,
                                    borderTopRight: borderTopRight,
                                    borderBottomRight: borderBottomRight,
                                    borderBottomLeft: borderBottomLeft,
                                    borderWidth: borderWidth,
                                    borderHDR: borderHDR,
                                    showBorder: showBorder
                                )
                            )
                            .shadow(color: .black.opacity(shadowOpacity), radius: shadowRadius, y: 4)
                            
                            // Apple's native glass
                            VStack(alignment: .leading, spacing: 8) {
                                Image(systemName: "heart.fill")
                                    .font(.title2)
                                    .foregroundColor(.red)
                                    .padding(8)
                                    .background(Color.red.opacity(0.15))
                                    .cornerRadius(8)
                                
                                Text("Apple")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: cornerRadius))
                        }
                        .padding(.horizontal)
                        .padding(.top, 16)
                        
                        // Background picker
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Background")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Picker("Background", selection: $backgroundIndex) {
                                Text("Purple").tag(0)
                                Text("Orange").tag(1)
                                Text("Green").tag(2)
                                Text("Light").tag(3)
                                Text("Gray").tag(4)
                                Text("Image").tag(5)
                            }
                            .pickerStyle(.segmented)
                        }
                        .padding(.horizontal)
                        
                        // Sliders - Border first for tuning
                        VStack(spacing: 16) {
                            Text("Border (4 corners)")
                                .font(.caption.bold())
                                .frame(maxWidth: .infinity, alignment: .leading)
                            
                            HStack(spacing: 16) {
                                VStack {
                                    Text("↖").font(.caption)
                                    Slider(value: $borderTopLeft, in: 0...1)
                                    Text(String(format: "%.2f", borderTopLeft)).font(.caption2)
                                }
                                VStack {
                                    Text("↗").font(.caption)
                                    Slider(value: $borderTopRight, in: 0...1)
                                    Text(String(format: "%.2f", borderTopRight)).font(.caption2)
                                }
                            }
                            
                            HStack(spacing: 16) {
                                VStack {
                                    Text("↙").font(.caption)
                                    Slider(value: $borderBottomLeft, in: 0...1)
                                    Text(String(format: "%.2f", borderBottomLeft)).font(.caption2)
                                }
                                VStack {
                                    Text("↘").font(.caption)
                                    Slider(value: $borderBottomRight, in: 0...1)
                                    Text(String(format: "%.2f", borderBottomRight)).font(.caption2)
                                }
                            }
                            
                            SliderRow(title: "Border Width", value: $borderWidth, range: 0...5)
                            SliderRow(title: "Border HDR", value: $borderHDR, range: 0...0.5)
                            
                            Toggle("Show Border", isOn: $showBorder)
                                .font(.subheadline)
                            
                            Divider()
                            
                            Text("Base Layers")
                                .font(.caption.bold())
                                .frame(maxWidth: .infinity, alignment: .leading)
                            
                            SliderRow(title: "Base White", value: $baseOpacity, range: 0...1)
                            SliderRow(title: "Gradient Top", value: $gradientTop, range: 0...1)
                            SliderRow(title: "Gradient Bottom", value: $gradientBottom, range: 0...1)
                            SliderRow(title: "HDR Boost", value: $hdrBoost, range: 0...0.5)
                            
                            Divider()
                            
                            Text("Shape & Shadow")
                                .font(.caption.bold())
                                .frame(maxWidth: .infinity, alignment: .leading)
                            
                            SliderRow(title: "Corner Radius", value: $cornerRadius, range: 8...32)
                            SliderRow(title: "Shadow Radius", value: $shadowRadius, range: 0...24)
                            SliderRow(title: "Shadow Opacity", value: $shadowOpacity, range: 0...0.3)
                        }
                        .padding()
                        .background(.ultraThinMaterial)
                        .cornerRadius(16)
                        .padding(.horizontal)
                        
                        // Export button
                        Button {
                            exportConfig()
                        } label: {
                            Label("Copy Config", systemImage: "doc.on.doc")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(.black)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                        }
                        .padding(.horizontal)
                        
                        // Reset button
                        Button("Reset to Defaults") {
                            resetToDefaults()
                        }
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        
                        Spacer(minLength: 100)
                    }
                }
            }
            .navigationTitle("Glass Playground")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
    
    private func resetToDefaults() {
        withAnimation {
            cornerRadius = 20.0
            baseOpacity = 0.70
            gradientTop = 0.29
            gradientBottom = 0.0
            hdrBoost = 0.05
            borderTopLeft = 1.0
            borderTopRight = 0.20
            borderBottomRight = 1.0
            borderBottomLeft = 0.20
            borderWidth = 0.9
            borderHDR = 0.03
            shadowRadius = 8.0
            shadowOpacity = 0.04
            showBorder = true
        }
    }
    
    private func exportConfig() {
        let config = """
        // Glass Configuration - Tuned Values
        cornerRadius: \(String(format: "%.1f", cornerRadius))
        baseOpacity: \(String(format: "%.2f", baseOpacity))
        gradientTop: \(String(format: "%.2f", gradientTop))
        gradientBottom: \(String(format: "%.2f", gradientBottom))
        hdrBoost: \(String(format: "%.2f", hdrBoost))
        borderTopLeft: \(String(format: "%.2f", borderTopLeft))
        borderTopRight: \(String(format: "%.2f", borderTopRight))
        borderBottomRight: \(String(format: "%.2f", borderBottomRight))
        borderBottomLeft: \(String(format: "%.2f", borderBottomLeft))
        borderWidth: \(String(format: "%.1f", borderWidth))
        borderHDR: \(String(format: "%.2f", borderHDR))
        shadowRadius: \(String(format: "%.1f", shadowRadius))
        shadowOpacity: \(String(format: "%.2f", shadowOpacity))
        showBorder: \(showBorder)
        """
        UIPasteboard.general.string = config
        
        // Haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }
}

// MARK: - Slider Row

struct SliderRow: View {
    let title: String
    @Binding var value: CGFloat
    let range: ClosedRange<CGFloat>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text(String(format: "%.2f", value))
                    .font(.caption.monospacedDigit())
                    .foregroundColor(.primary)
            }
            Slider(value: $value, in: range)
        }
    }
}

// MARK: - Custom Glass Background (Simplified)

struct CustomGlassBackground: View {
    let cornerRadius: CGFloat
    let baseOpacity: CGFloat        // Full coverage white base
    let gradientTop: CGFloat        // Gradient top opacity
    let gradientBottom: CGFloat     // Gradient bottom opacity
    let hdrBoost: CGFloat           // Brightness boost for HDR effect
    let borderTopLeft: CGFloat      // ↖ corner opacity
    let borderTopRight: CGFloat     // ↗ corner opacity
    let borderBottomRight: CGFloat  // ↘ corner opacity
    let borderBottomLeft: CGFloat   // ↙ corner opacity
    let borderWidth: CGFloat
    let borderHDR: CGFloat          // Border HDR boost
    let showBorder: Bool
    
    // Pre-compute gradient stops to help compiler
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
            
            // Layer 3: 4-corner gradient border (DEBUG: red so you can see it)
            if showBorder {
                BorderView(
                    cornerRadius: cornerRadius,
                    borderWidth: borderWidth,
                    borderHDR: borderHDR,
                    stops: borderGradientStops
                )
            }
        }
        // HDR boost - pushes brightness beyond normal 0-1 range
        .brightness(hdrBoost)
    }
}

// Separate view to help compiler with type checking
struct BorderView: View {
    let cornerRadius: CGFloat
    let borderWidth: CGFloat
    let borderHDR: CGFloat
    let stops: [Gradient.Stop]
    
    var body: some View {
        // Use gradient directly as stroke color
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .stroke(
                AngularGradient(
                    stops: stops,
                    center: .center,
                    startAngle: .degrees(-90),
                    endAngle: .degrees(270)
                ),
                lineWidth: borderWidth
            )
            .brightness(borderHDR)
    }
}

// MARK: - Preview

#Preview {
    GlassPlayground()
}

