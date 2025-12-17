//
//  OnboardingPrincipleSelectView.swift
//  Pillars
//
//  TikTok-style principle selection - swipe through and save principles
//

import SwiftUI

struct OnboardingPrincipleSelectView: View {
    let pillar: PillarOption
    let availablePrinciples: [String]
    let savedPrinciples: [String]
    @Binding var selectedPrinciple: String?
    let onSavePrinciple: () -> Void
    let onReviewSaves: () -> Void
    
    @State private var currentIndex: Int = 0
    @State private var saveAnimations: [String: Bool] = [:]
    
    private var allPrinciples: [String] {
        availablePrinciples
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background
                Color.black.ignoresSafeArea()
                
                // Vertical paging ScrollView (TikTok-style)
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(allPrinciples.enumerated()), id: \.offset) { index, principle in
                            PrincipleCard(
                                principle: principle,
                                pillarTitle: pillar.title,
                                isSaved: savedPrinciples.contains(principle),
                                showSaveAnimation: saveAnimations[principle] ?? false,
                                onSave: {
                                    savePrinciple(principle, at: index)
                                }
                            )
                            .frame(width: geometry.size.width, height: geometry.size.height)
                            .id(index)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.paging)
                .scrollPosition(id: Binding(
                    get: { currentIndex },
                    set: { if let newValue = $0 { currentIndex = newValue } }
                ))
                .ignoresSafeArea()
                
                // Overlay UI
                VStack {
                    // Top bar with saved count and review button
                    HStack {
                        // Saved count
                        if !savedPrinciples.isEmpty {
                            HStack(spacing: 6) {
                                Image(systemName: "bookmark.fill")
                                    .font(.system(size: 14))
                                Text("\(savedPrinciples.count)")
                                    .font(.system(size: 15, weight: .semibold))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(Color.white.opacity(0.2))
                            )
                        }
                        
                        Spacer()
                        
                        // Review saves button
                        if !savedPrinciples.isEmpty {
                            Button {
                                onReviewSaves()
                            } label: {
                                Text("Review")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.black)
                                    .padding(.horizontal, 20)
                                    .padding(.vertical, 10)
                                    .background(
                                        Capsule()
                                            .fill(Color.white)
                                    )
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 60)
                    
                    Spacer()
                    
                    // Right side progress indicator (vertical dots like TikTok)
                    HStack {
                        Spacer()
                        
                        VStack(spacing: 6) {
                            ForEach(0..<allPrinciples.count, id: \.self) { index in
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(index == currentIndex ? Color.white : Color.white.opacity(0.3))
                                    .frame(width: 3, height: index == currentIndex ? 20 : 12)
                                    .animation(.easeInOut(duration: 0.2), value: currentIndex)
                            }
                        }
                        .padding(.trailing, 16)
                    }
                    
                    Spacer()
                        .frame(height: 100)
                }
            }
        }
    }
    
    private func savePrinciple(_ principle: String, at index: Int) {
        // Don't allow saving already saved principles
        guard !savedPrinciples.contains(principle) else { return }
        
        // Trigger animation
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
            saveAnimations[principle] = true
        }
        
        // Set selected and trigger save
        selectedPrinciple = principle
        
        // Delay to show animation, then save
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            onSavePrinciple()
            
            // Move to next principle if available
            if index < allPrinciples.count - 1 {
                withAnimation(.easeInOut(duration: 0.3)) {
                    currentIndex = index + 1
                }
            }
        }
    }
}

// MARK: - Principle Card

struct PrincipleCard: View {
    let principle: String
    let pillarTitle: String
    let isSaved: Bool
    let showSaveAnimation: Bool
    let onSave: () -> Void
    
    @State private var bookmarkScale: CGFloat = 1.0
    @State private var showBigBookmark: Bool = false
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Gradient background
                LinearGradient(
                    colors: [
                        Color(hex: "1a1a2e"),
                        Color(hex: "16213e"),
                        Color(hex: "0f0f23")
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                // Content
                HStack(alignment: .center, spacing: 0) {
                    // Main text area (tappable for save)
                    VStack(alignment: .leading, spacing: 16) {
                        // Pillar label
                        Text(pillarTitle.uppercased())
                            .font(.system(size: 12, weight: .bold))
                            .tracking(2)
                            .foregroundColor(.white.opacity(0.5))
                        
                        // Principle text
                        Text(principle)
                            .font(.system(size: 28, weight: .medium, design: .serif))
                            .foregroundColor(.white)
                            .lineSpacing(8)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        
                        // Hint text
                        if !isSaved {
                            Text("Double tap to save")
                                .font(.system(size: 13))
                                .foregroundColor(.white.opacity(0.4))
                                .padding(.top, 8)
                        } else {
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 14))
                                Text("Saved")
                                    .font(.system(size: 13))
                            }
                            .foregroundColor(Color(hex: "4ECDC4"))
                            .padding(.top, 8)
                        }
                    }
                    .padding(.leading, 24)
                    .padding(.trailing, 80)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .onTapGesture(count: 2) {
                        if !isSaved {
                            triggerSave()
                        }
                    }
                    
                    Spacer()
                }
                .frame(maxHeight: .infinity)
                .padding(.vertical, 100)
                
                // Right side action buttons
                VStack(spacing: 24) {
                    Spacer()
                    
                    // Save button
                    Button {
                        if !isSaved {
                            triggerSave()
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
                                .font(.system(size: 32))
                                .foregroundColor(isSaved ? Color(hex: "4ECDC4") : .white)
                                .scaleEffect(bookmarkScale)
                            
                            Text(isSaved ? "Saved" : "Save")
                                .font(.system(size: 12))
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }
                    .disabled(isSaved)
                    
                    Spacer()
                        .frame(height: 120)
                }
                .padding(.trailing, 16)
                .frame(maxWidth: .infinity, alignment: .trailing)
                
                // Big bookmark animation overlay
                if showBigBookmark {
                    Image(systemName: "bookmark.fill")
                        .font(.system(size: 100))
                        .foregroundColor(Color(hex: "4ECDC4"))
                        .transition(.scale.combined(with: .opacity))
                }
            }
        }
    }
    
    private func triggerSave() {
        // Bookmark button animation
        withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
            bookmarkScale = 1.3
        }
        
        // Show big bookmark
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
            showBigBookmark = true
        }
        
        // Reset bookmark scale
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                bookmarkScale = 1.0
            }
        }
        
        // Hide big bookmark
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            withAnimation(.easeOut(duration: 0.2)) {
                showBigBookmark = false
            }
        }
        
        // Trigger actual save
        onSave()
    }
}

// MARK: - Flow Layout for pills

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                       y: bounds.minY + result.positions[index].y),
                         proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []
        
        init(in width: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var rowHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if x + size.width > width && x > 0 {
                    x = 0
                    y += rowHeight + spacing
                    rowHeight = 0
                }
                
                positions.append(CGPoint(x: x, y: y))
                rowHeight = max(rowHeight, size.height)
                x += size.width + spacing
                
                self.size.width = max(self.size.width, x)
            }
            
            self.size.height = y + rowHeight
        }
    }
}

#Preview {
    OnboardingPrincipleSelectView(
        pillar: PillarOption(id: "marriage", title: "Marriage"),
        availablePrinciples: [
            "Keep the friendship and fun at the heart of your marriage.",
            "I recognize that marrying someone with different core values means signing up for harder work, so I prioritize alignment on fundamental orientations toward life, money, family, and faith.",
            "I aim to give more than I get. Both of us trying to give 60% creates a surplus of generosity.",
            "I wake up each morning thinking: What can I do to make my partner's day just a little happier?"
        ],
        savedPrinciples: [],
        selectedPrinciple: .constant(nil),
        onSavePrinciple: { print("Save principle") },
        onReviewSaves: { print("Review saves") }
    )
}
