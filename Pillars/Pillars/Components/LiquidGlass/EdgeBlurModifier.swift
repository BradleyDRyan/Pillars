//
//  EdgeBlurModifier.swift
//  Pillars
//
//  Variable blur effect at scroll view edges, similar to iOS 26 system behavior
//  Inspired by Linear's implementation
//

import SwiftUI

// MARK: - Edge Blur Configuration

struct EdgeBlurConfiguration {
    /// Height of the blur zone at top edge
    var topBlurHeight: CGFloat = 40
    
    /// Height of the blur zone at bottom edge
    var bottomBlurHeight: CGFloat = 40
    
    /// Maximum blur radius
    var maxBlurRadius: CGFloat = 8
    
    /// Whether to show top edge blur
    var showTopBlur: Bool = true
    
    /// Whether to show bottom edge blur
    var showBottomBlur: Bool = true
    
    /// Tint color overlay (typically matches background)
    var tintColor: Color = .clear
    var tintOpacity: CGFloat = 0.3
    
    static let `default` = EdgeBlurConfiguration()
    
    static let subtle = EdgeBlurConfiguration(
        topBlurHeight: 24,
        bottomBlurHeight: 24,
        maxBlurRadius: 4
    )
    
    static let prominent = EdgeBlurConfiguration(
        topBlurHeight: 60,
        bottomBlurHeight: 60,
        maxBlurRadius: 12
    )
}

// MARK: - Edge Blur Mask

/// Creates a gradient mask for edge blur effect
struct EdgeBlurMask: View {
    let configuration: EdgeBlurConfiguration
    let edge: Edge
    
    var body: some View {
        GeometryReader { geometry in
            let height = edge == .top ? configuration.topBlurHeight : configuration.bottomBlurHeight
            
            LinearGradient(
                colors: [
                    Color.black.opacity(1.0),
                    Color.black.opacity(0.0)
                ],
                startPoint: edge == .top ? .top : .bottom,
                endPoint: edge == .top ? .bottom : .top
            )
            .frame(height: height)
            .frame(maxWidth: .infinity)
            .position(
                x: geometry.size.width / 2,
                y: edge == .top ? height / 2 : geometry.size.height - height / 2
            )
        }
    }
}

// MARK: - Edge Blur View

/// A view that applies variable blur to the edges of its content
struct EdgeBlurView<Content: View>: View {
    let configuration: EdgeBlurConfiguration
    let content: Content
    
    @Environment(\.accessibilityReduceTransparency) var reduceTransparency
    
    init(
        configuration: EdgeBlurConfiguration = .default,
        @ViewBuilder content: () -> Content
    ) {
        self.configuration = configuration
        self.content = content()
    }
    
    var body: some View {
        if reduceTransparency {
            // Skip blur for accessibility
            content
        } else {
            ZStack {
                content
                
                // Top edge blur overlay
                if configuration.showTopBlur {
                    VStack {
                        EdgeGradientBlur(
                            height: configuration.topBlurHeight,
                            maxBlurRadius: configuration.maxBlurRadius,
                            edge: .top,
                            tintColor: configuration.tintColor,
                            tintOpacity: configuration.tintOpacity
                        )
                        Spacer()
                    }
                    .allowsHitTesting(false)
                }
                
                // Bottom edge blur overlay
                if configuration.showBottomBlur {
                    VStack {
                        Spacer()
                        EdgeGradientBlur(
                            height: configuration.bottomBlurHeight,
                            maxBlurRadius: configuration.maxBlurRadius,
                            edge: .bottom,
                            tintColor: configuration.tintColor,
                            tintOpacity: configuration.tintOpacity
                        )
                    }
                    .allowsHitTesting(false)
                }
            }
        }
    }
}

// MARK: - Edge Gradient Blur

/// Renders a gradient blur effect at a specific edge
struct EdgeGradientBlur: View {
    let height: CGFloat
    let maxBlurRadius: CGFloat
    let edge: Edge
    let tintColor: Color
    let tintOpacity: CGFloat
    
    var body: some View {
        ZStack {
            // Multi-layer blur for variable effect
            ForEach(0..<5) { index in
                let progress = CGFloat(index) / 4.0
                let blurAmount = maxBlurRadius * (1.0 - progress)
                let opacity = pow(1.0 - progress, 2)
                
                BlurLayer(
                    blurRadius: blurAmount,
                    edge: edge,
                    layerProgress: progress
                )
                .opacity(opacity)
            }
            
            // Subtle tint overlay for color matching
            LinearGradient(
                colors: [
                    tintColor.opacity(tintOpacity),
                    tintColor.opacity(0)
                ],
                startPoint: edge == .top ? .top : .bottom,
                endPoint: edge == .top ? .bottom : .top
            )
        }
        .frame(height: height)
    }
}

// MARK: - Blur Layer

/// A single blur layer for the variable blur effect
struct BlurLayer: View {
    let blurRadius: CGFloat
    let edge: Edge
    let layerProgress: CGFloat
    
    var body: some View {
        GeometryReader { geometry in
            let layerHeight = geometry.size.height * (1.0 - layerProgress * 0.8)
            
            Rectangle()
                .fill(Color.clear)
                .background(
                    BackdropBlurView(radius: blurRadius)
                )
                .mask(
                    LinearGradient(
                        colors: [
                            Color.white,
                            Color.white.opacity(0)
                        ],
                        startPoint: edge == .top ? .top : .bottom,
                        endPoint: edge == .top ? .bottom : .top
                    )
                )
                .frame(height: layerHeight)
                .frame(maxWidth: .infinity)
                .position(
                    x: geometry.size.width / 2,
                    y: edge == .top ? layerHeight / 2 : geometry.size.height - layerHeight / 2
                )
        }
    }
}

// MARK: - View Extension

extension View {
    /// Applies variable blur to the edges of a scroll view
    func edgeBlur(_ configuration: EdgeBlurConfiguration = .default) -> some View {
        EdgeBlurView(configuration: configuration) {
            self
        }
    }
    
    /// Applies variable blur to the top edge only
    func topEdgeBlur(height: CGFloat = 40, blurRadius: CGFloat = 8) -> some View {
        EdgeBlurView(configuration: EdgeBlurConfiguration(
            topBlurHeight: height,
            bottomBlurHeight: 0,
            maxBlurRadius: blurRadius,
            showTopBlur: true,
            showBottomBlur: false
        )) {
            self
        }
    }
    
    /// Applies variable blur to the bottom edge only
    func bottomEdgeBlur(height: CGFloat = 40, blurRadius: CGFloat = 8) -> some View {
        EdgeBlurView(configuration: EdgeBlurConfiguration(
            topBlurHeight: 0,
            bottomBlurHeight: height,
            maxBlurRadius: blurRadius,
            showTopBlur: false,
            showBottomBlur: true
        )) {
            self
        }
    }
}

// MARK: - Preview

#Preview("Edge Blur Effect") {
    NavigationStack {
        ScrollView {
            VStack(spacing: 16) {
                ForEach(0..<20) { index in
                    HStack {
                        Circle()
                            .fill(Color.blue.opacity(0.3))
                            .frame(width: 50, height: 50)
                        
                        VStack(alignment: .leading) {
                            Text("Item \(index + 1)")
                                .font(.headline)
                            Text("This is a sample list item with edge blur")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                    }
                    .padding()
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)
                }
            }
            .padding()
        }
        .edgeBlur(EdgeBlurConfiguration(
            topBlurHeight: 50,
            bottomBlurHeight: 60,
            maxBlurRadius: 10,
            tintColor: Color(UIColor.systemBackground),
            tintOpacity: 0.5
        ))
        .navigationTitle("Edge Blur Demo")
    }
}
