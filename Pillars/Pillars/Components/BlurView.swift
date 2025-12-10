//
//  BlurView.swift
//  Pillars
//
//  Backdrop blur effect with controllable radius
//

import SwiftUI

/// A View in which content reflects all behind it
struct BackdropView: UIViewRepresentable {
    func makeUIView(context: Context) -> UIVisualEffectView {
        let view = UIVisualEffectView()
        let blur = UIBlurEffect()
        let animator = UIViewPropertyAnimator()
        animator.addAnimations { view.effect = blur }
        animator.fractionComplete = 0
        animator.stopAnimation(false)
        animator.finishAnimation(at: .current)
        return view
    }
    
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {}
}

/// A transparent View that blurs its background with controllable radius
struct BackdropBlurView: View {
    let radius: CGFloat
    
    var body: some View {
        BackdropView()
            .blur(radius: radius, opaque: true)
    }
}

// Legacy BlurView for compatibility
struct BlurView: UIViewRepresentable {
    let style: UIBlurEffect.Style
    
    func makeUIView(context: UIViewRepresentableContext<BlurView>) -> UIView {
        let view = UIView(frame: .zero)
        view.backgroundColor = .clear
        let blurEffect = UIBlurEffect(style: style)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.translatesAutoresizingMaskIntoConstraints = false
        view.insertSubview(blurView, at: 0)
        NSLayoutConstraint.activate([
            blurView.heightAnchor.constraint(equalTo: view.heightAnchor),
            blurView.widthAnchor.constraint(equalTo: view.widthAnchor),
        ])
        return view
    }
    
    func updateUIView(_ uiView: UIView, context: UIViewRepresentableContext<BlurView>) {}
}

#Preview {
    ZStack {
        Image(systemName: "globe")
            .resizable()
            .frame(width: 200, height: 200)
            .foregroundColor(.blue)
        
        BackdropBlurView(radius: 6)
            .frame(width: 120, height: 200)
    }
}
