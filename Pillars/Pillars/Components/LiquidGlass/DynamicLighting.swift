//
//  DynamicLighting.swift
//  Pillars
//
//  Dynamic lighting system for liquid glass effects
//  Calculates real-time specular highlights based on device motion and touch
//

import SwiftUI
import CoreMotion
import simd

// MARK: - Light Source

/// Represents a virtual light source position
struct LightSource {
    var position: SIMD3<Float>
    var intensity: Float
    var color: Color
    
    static let `default` = LightSource(
        position: SIMD3<Float>(0.3, -0.5, 1.0),
        intensity: 1.0,
        color: .white
    )
    
    /// Creates a light position from normalized 2D coordinates (0-1)
    static func from2D(x: CGFloat, y: CGFloat, intensity: Float = 1.0) -> LightSource {
        LightSource(
            position: SIMD3<Float>(Float(x - 0.5) * 2, Float(y - 0.5) * 2, 1.0),
            intensity: intensity,
            color: .white
        )
    }
}

// MARK: - Motion Manager

/// Manages device motion for dynamic lighting
class MotionLightingManager: ObservableObject {
    static let shared = MotionLightingManager()
    
    @Published var lightPosition: CGPoint = CGPoint(x: 0.5, y: 0.3)
    @Published var isActive: Bool = false
    
    private let motionManager = CMMotionManager()
    private var updateTimer: Timer?
    
    private init() {}
    
    func startUpdates() {
        guard motionManager.isDeviceMotionAvailable else { return }
        
        isActive = true
        motionManager.deviceMotionUpdateInterval = 1.0 / 30.0 // 30 fps
        
        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, error in
            guard let motion = motion, error == nil else { return }
            
            // Convert device attitude to light position
            let roll = motion.attitude.roll
            let pitch = motion.attitude.pitch
            
            // Map device rotation to light position (normalized 0-1)
            let x = 0.5 + CGFloat(roll) / .pi * 0.3
            let y = 0.3 + CGFloat(pitch) / .pi * 0.2
            
            withAnimation(.easeOut(duration: 0.1)) {
                self?.lightPosition = CGPoint(
                    x: max(0, min(1, x)),
                    y: max(0, min(1, y))
                )
            }
        }
    }
    
    func stopUpdates() {
        motionManager.stopDeviceMotionUpdates()
        isActive = false
        
        // Reset to default position
        withAnimation(.easeOut(duration: 0.3)) {
            lightPosition = CGPoint(x: 0.5, y: 0.3)
        }
    }
}

// MARK: - Dynamic Lighting Environment Key

struct LightPositionKey: EnvironmentKey {
    static let defaultValue: CGPoint = CGPoint(x: 0.5, y: 0.3)
}

extension EnvironmentValues {
    var lightPosition: CGPoint {
        get { self[LightPositionKey.self] }
        set { self[LightPositionKey.self] = newValue }
    }
}

// MARK: - Dynamic Lighting Modifier

struct DynamicLightingModifier: ViewModifier {
    @StateObject private var motionManager = MotionLightingManager.shared
    let enabled: Bool
    
    func body(content: Content) -> some View {
        content
            .environment(\.lightPosition, motionManager.lightPosition)
            .onAppear {
                if enabled {
                    motionManager.startUpdates()
                }
            }
            .onDisappear {
                if enabled {
                    motionManager.stopUpdates()
                }
            }
    }
}

// MARK: - Specular Calculation

/// Pure Swift implementation of specular highlight calculation
struct SpecularCalculator {
    /// Calculate specular intensity for a point on a surface
    /// - Parameters:
    ///   - point: Normalized position on surface (0-1)
    ///   - lightPosition: Light source position
    ///   - shininess: How focused the highlight is (higher = tighter)
    /// - Returns: Specular intensity (0-1)
    static func calculateSpecular(
        at point: CGPoint,
        lightPosition: CGPoint,
        viewPosition: CGPoint = CGPoint(x: 0.5, y: 0.5),
        shininess: CGFloat = 32
    ) -> CGFloat {
        // Surface normal (pointing towards viewer for flat surface)
        let normal = SIMD3<Float>(0, 0, 1)
        
        // Light direction
        let lightDir = normalize(SIMD3<Float>(
            Float(lightPosition.x - point.x),
            Float(lightPosition.y - point.y),
            1.0
        ))
        
        // View direction
        let viewDir = normalize(SIMD3<Float>(
            Float(viewPosition.x - point.x),
            Float(viewPosition.y - point.y),
            1.0
        ))
        
        // Reflection direction (Blinn-Phong)
        let halfVector = normalize(lightDir + viewDir)
        
        // Specular intensity
        let nDotH = max(dot(normal, halfVector), 0)
        let specular = pow(nDotH, Float(shininess))
        
        return CGFloat(specular)
    }
    
    /// Generate a specular gradient for a rectangle
    static func specularGradient(
        lightPosition: CGPoint,
        intensity: CGFloat = 0.6,
        shininess: CGFloat = 16
    ) -> LinearGradient {
        // Calculate gradient direction based on light position
        let lightX = lightPosition.x - 0.5
        let lightY = lightPosition.y - 0.5
        
        let startPoint = UnitPoint(
            x: 0.5 - lightX * 0.5,
            y: max(0, lightY)
        )
        let endPoint = UnitPoint(
            x: 0.5 + lightX * 0.5,
            y: min(1, 1.0 - lightY)
        )
        
        return LinearGradient(
            colors: [
                Color.white.opacity(intensity * 0.4),
                Color.white.opacity(intensity * 0.15),
                Color.clear
            ],
            startPoint: startPoint,
            endPoint: endPoint
        )
    }
}

// MARK: - Animated Light View

/// A view that renders animated specular highlights
struct AnimatedSpecularView: View {
    let cornerRadius: CGFloat
    let intensity: CGFloat
    
    @State private var phase: CGFloat = 0
    @Environment(\.lightPosition) var lightPosition
    
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30)) { timeline in
            GeometryReader { geometry in
                let animatedPosition = CGPoint(
                    x: lightPosition.x + sin(phase) * 0.02,
                    y: lightPosition.y + cos(phase) * 0.01
                )
                
                SpecularHighlightView(
                    cornerRadius: cornerRadius,
                    intensity: intensity,
                    lightPosition: animatedPosition
                )
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) {
                phase = .pi * 2
            }
        }
    }
}

// MARK: - View Extensions

extension View {
    /// Enable dynamic lighting based on device motion
    func dynamicLighting(enabled: Bool = true) -> some View {
        modifier(DynamicLightingModifier(enabled: enabled))
    }
}

// MARK: - Preview

#Preview("Dynamic Lighting") {
    ZStack {
        LinearGradient(
            colors: [.purple, .blue, .cyan],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
        
        VStack(spacing: 24) {
            Text("Dynamic Lighting")
                .font(.title.bold())
                .foregroundColor(.white)
                .padding(.horizontal, 32)
                .padding(.vertical, 20)
                .liquidGlass(GlassConfiguration(
                    cornerRadius: 20,
                    highlightIntensity: 0.7
                ))
            
            Text("Move device to see highlights shift")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
        }
    }
    .dynamicLighting()
}
