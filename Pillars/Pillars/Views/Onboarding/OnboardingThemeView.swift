//
//  OnboardingThemeView.swift
//  Pillars
//
//  "What's the one thing you most want to get right with [Pillar]?"
//

import SwiftUI

struct OnboardingThemeView: View {
    let pillar: PillarOption
    let themes: [OnboardingTheme]
    let lockedPrinciples: [String]
    @Binding var selectedTheme: OnboardingTheme?
    let onContinue: () -> Void
    let onFinish: () -> Void
    
    private var isFirstPrinciple: Bool {
        lockedPrinciples.isEmpty
    }
    
    private var titleText: String {
        if isFirstPrinciple {
            return "What's the one thing you most want to get right with \(pillar.title)?"
        } else {
            return "What else matters to you for \(pillar.title)?"
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.lg) {
            // Title
            Text(titleText)
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(S2.Colors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            
            // Locked principles indicator
            if !lockedPrinciples.isEmpty {
                lockedPrinciplesView
            }
            
            // Selection options
            ScrollView(showsIndicators: false) {
                VStack(spacing: S2.Spacing.md) {
                    ForEach(themes) { theme in
                        OnboardingSelectionRow(
                            title: theme.title,
                            isSelected: selectedTheme?.id == theme.id
                        ) {
                            selectTheme(theme)
                        }
                    }
                }
                .padding(.bottom, 100) // Space for bottom button
            }
            
            Spacer(minLength: 0)
            
            // "I'm good" button (only after at least one principle)
            if !lockedPrinciples.isEmpty {
                Button {
                    onFinish()
                } label: {
                    Text("I'm good with \(lockedPrinciples.count) principle\(lockedPrinciples.count == 1 ? "" : "s")")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(S2.Spacing.lg)
                        .background(
                            Capsule()
                                .fill(Color.black)
                        )
                }
            }
        }
    }
    
    private var lockedPrinciplesView: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.sm) {
            HStack(spacing: S2.Spacing.xs) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.system(size: 14))
                Text("\(lockedPrinciples.count) locked")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(S2.Colors.secondaryText)
            }
            
            // Show the principles as compact pills
            FlowLayout(spacing: S2.Spacing.xs) {
                ForEach(lockedPrinciples, id: \.self) { principle in
                    Text(principle)
                        .font(.system(size: 12))
                        .foregroundColor(S2.Colors.primaryText)
                        .padding(.horizontal, S2.Spacing.sm)
                        .padding(.vertical, S2.Spacing.xs)
                        .background(
                            Capsule()
                                .fill(S2.Colors.secondarySurface)
                        )
                        .lineLimit(1)
                }
            }
        }
        .padding(S2.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: S2.CornerRadius.md)
                .fill(S2.Colors.secondarySurface.opacity(0.5))
        )
    }
    
    private func selectTheme(_ theme: OnboardingTheme) {
        withAnimation(.easeInOut(duration: 0.2)) {
            selectedTheme = theme
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            onContinue()
        }
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
    OnboardingThemeView(
        pillar: PillarOption(id: "finances", title: "Finances"),
        themes: OnboardingTheme.themes(for: "finances"),
        lockedPrinciples: ["Track every dollar", "Pay myself first"],
        selectedTheme: .constant(nil),
        onContinue: { print("Continue") },
        onFinish: { print("Finish") }
    )
    .padding(.horizontal, S2.Spacing.xl)
    .padding(.top, S2.Spacing.xxl)
    .padding(.bottom, S2.Spacing.xl)
    .background(S2.Colors.primarySurface)
}


