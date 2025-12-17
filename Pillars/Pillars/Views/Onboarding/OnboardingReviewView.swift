//
//  OnboardingReviewView.swift
//  Pillars
//
//  Review and refine saved principles before committing
//

import SwiftUI

struct OnboardingReviewView: View {
    let pillar: PillarOption
    @Binding var savedPrinciples: [String]
    let onAddMore: () -> Void
    let onConfirm: () -> Void
    
    @State private var principleToRemove: String?
    @State private var showRemoveAnimation: [String: Bool] = [:]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 8) {
                Text("Your Principles")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(S2.Colors.primaryText)
                
                Text("Review and refine your selections for \(pillar.title)")
                    .font(.system(size: 15))
                    .foregroundColor(S2.Colors.secondaryText)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 60)
            .padding(.horizontal, S2.Spacing.xl)
            
            // Saved principles count
            HStack(spacing: 6) {
                Image(systemName: "bookmark.fill")
                    .font(.system(size: 14))
                Text("\(savedPrinciples.count) saved")
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundColor(Color(hex: "4ECDC4"))
            .padding(.top, S2.Spacing.lg)
            
            // Principles list
            ScrollView(showsIndicators: false) {
                VStack(spacing: S2.Spacing.md) {
                    ForEach(savedPrinciples, id: \.self) { principle in
                        SavedPrincipleRow(
                            principle: principle,
                            isRemoving: showRemoveAnimation[principle] ?? false,
                            onRemove: {
                                removePrinciple(principle)
                            }
                        )
                        .transition(.asymmetric(
                            insertion: .scale.combined(with: .opacity),
                            removal: .scale.combined(with: .opacity)
                        ))
                    }
                }
                .padding(.horizontal, S2.Spacing.xl)
                .padding(.top, S2.Spacing.xxl)
                .padding(.bottom, 160)
            }
            
            Spacer()
        }
        .background(S2.Colors.primarySurface.ignoresSafeArea())
        .overlay(alignment: .bottom) {
            // Bottom action buttons
            VStack(spacing: S2.Spacing.md) {
                // Add more button
                Button {
                    onAddMore()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .semibold))
                        Text("Add More")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .foregroundColor(S2.Colors.primaryText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, S2.Spacing.lg)
                    .background(
                        RoundedRectangle(cornerRadius: S2.CornerRadius.lg)
                            .stroke(S2.Colors.secondaryText.opacity(0.3), lineWidth: 1)
                    )
                }
                
                // Confirm button
                Button {
                    onConfirm()
                } label: {
                    Text("Confirm \(savedPrinciples.count) Principle\(savedPrinciples.count == 1 ? "" : "s")")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, S2.Spacing.lg)
                        .background(
                            RoundedRectangle(cornerRadius: S2.CornerRadius.lg)
                                .fill(Color.black)
                        )
                }
                .disabled(savedPrinciples.isEmpty)
                .opacity(savedPrinciples.isEmpty ? 0.5 : 1)
            }
            .padding(.horizontal, S2.Spacing.xl)
            .padding(.bottom, 40)
            .background(
                LinearGradient(
                    colors: [
                        S2.Colors.primarySurface.opacity(0),
                        S2.Colors.primarySurface,
                        S2.Colors.primarySurface
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 180)
                .allowsHitTesting(false)
            )
        }
    }
    
    private func removePrinciple(_ principle: String) {
        // Animate removal
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            showRemoveAnimation[principle] = true
        }
        
        // Remove after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                savedPrinciples.removeAll { $0 == principle }
            }
        }
    }
}

// MARK: - Saved Principle Row

struct SavedPrincipleRow: View {
    let principle: String
    let isRemoving: Bool
    let onRemove: () -> Void
    
    @State private var offset: CGFloat = 0
    @State private var showDeleteButton: Bool = false
    
    var body: some View {
        ZStack(alignment: .trailing) {
            // Delete background
            HStack {
                Spacer()
                Button {
                    onRemove()
                } label: {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.white)
                        .frame(width: 60, height: 60)
                        .background(Color.red)
                        .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.md))
                }
            }
            
            // Main content
            HStack(alignment: .top, spacing: S2.Spacing.md) {
                // Bookmark icon
                Image(systemName: "bookmark.fill")
                    .font(.system(size: 16))
                    .foregroundColor(Color(hex: "4ECDC4"))
                    .padding(.top, 2)
                
                // Principle text
                Text(principle)
                    .font(.system(size: 16))
                    .foregroundColor(S2.Colors.primaryText)
                    .lineSpacing(4)
                    .multilineTextAlignment(.leading)
                
                Spacer()
                
                // Remove button
                Button {
                    onRemove()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(S2.Colors.tertiaryText)
                        .padding(8)
                }
            }
            .padding(S2.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: S2.CornerRadius.md)
                    .fill(S2.Colors.secondarySurface)
            )
            .offset(x: offset)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        if value.translation.width < 0 {
                            offset = max(value.translation.width, -80)
                        }
                    }
                    .onEnded { value in
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            if value.translation.width < -50 {
                                offset = -70
                                showDeleteButton = true
                            } else {
                                offset = 0
                                showDeleteButton = false
                            }
                        }
                    }
            )
        }
        .scaleEffect(isRemoving ? 0.8 : 1)
        .opacity(isRemoving ? 0 : 1)
    }
}

#Preview {
    OnboardingReviewView(
        pillar: PillarOption(id: "marriage", title: "Marriage"),
        savedPrinciples: .constant([
            "Keep the friendship and fun at the heart of your marriage.",
            "I aim to give more than I get. Both of us trying to give 60% creates a surplus of generosity.",
            "I wake up each morning thinking: What can I do to make my partner's day just a little happier?"
        ]),
        onAddMore: { print("Add more") },
        onConfirm: { print("Confirm") }
    )
}

