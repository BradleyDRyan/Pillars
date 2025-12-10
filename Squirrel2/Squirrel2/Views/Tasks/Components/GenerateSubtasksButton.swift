//
//  GenerateSubtasksButton.swift
//  Squirrel2
//
//  Button to generate AI-powered subtasks
//

import SwiftUI

struct GenerateSubtasksButton: View {
    let isGenerating: Bool
    let onGenerate: () -> Void

    var body: some View {
        Button(action: onGenerate) {
            HStack(spacing: 8) {
                if isGenerating {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: "sparkles")
                        .font(.system(size: 16, weight: .semibold))
                }

                Text(isGenerating ? "Generating..." : "Generate Subtasks")
                    .font(.system(size: 15, weight: .semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.black)
                    .opacity(isGenerating ? 0.6 : 1.0)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.black.opacity(0.1), lineWidth: 1)
            )
        }
        .disabled(isGenerating)
        .animation(.easeInOut(duration: 0.2), value: isGenerating)
    }
}

struct GenerateSubtasksEmptyState: View {
    let isGenerating: Bool
    let onGenerate: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            // Icon
            ZStack {
                Circle()
                    .fill(S2.Colors.secondarySurface)
                    .frame(width: 60, height: 60)

                Image(systemName: "list.bullet.indent")
                    .font(.system(size: 24))
                    .foregroundColor(S2.Colors.secondaryText)
            }

            // Text
            VStack(spacing: 4) {
                Text("No subtasks yet")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(S2.Colors.primaryText)

                Text("Break this task into smaller steps")
                    .font(.system(size: 14))
                    .foregroundColor(S2.Colors.secondaryText)
            }

            // Button
            GenerateSubtasksButton(
                isGenerating: isGenerating,
                onGenerate: onGenerate
            )
        }
        .padding(.vertical, 24)
    }
}

#Preview {
    VStack(spacing: 24) {
        GenerateSubtasksButton(
            isGenerating: false,
            onGenerate: {}
        )

        GenerateSubtasksButton(
            isGenerating: true,
            onGenerate: {}
        )

        GenerateSubtasksEmptyState(
            isGenerating: false,
            onGenerate: {}
        )
    }
    .padding()
}