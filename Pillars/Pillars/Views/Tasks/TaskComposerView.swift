//
//  TaskComposerView.swift
//  Squirrel2
//
//  A custom composer view for creating tasks with a Case50-inspired UI
//

import SwiftUI
import FirebaseAuth

struct TaskComposerView: View {
    @StateObject private var viewModel = TasksViewModel()
    @State private var inputText = ""
    @FocusState private var isFocused: Bool

    var onTaskCreated: (() -> Void)?
    var onDismiss: (() -> Void)?

    private func createTask() {
        let title = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }

        // Create the new task with all required fields
        let newTask = UserTask(
            id: UUID().uuidString,
            userId: Auth.auth().currentUser?.uid ?? "",
            projectIds: [],
            conversationId: nil,
            title: title,
            description: "",
            status: .pending,
            priority: .medium,
            dueDate: nil,
            completedAt: nil,
            tags: [],
            createdAt: Date(),
            updatedAt: Date(),
            metadata: nil
        )

        Task {
            await viewModel.createTask(newTask)

            await MainActor.run {
                inputText = ""
                isFocused = false
                onTaskCreated?()
            }
        }
    }

    private func resetComposer() {
        withAnimation(.easeInOut(duration: 0.2)) {
            inputText = ""
            isFocused = false
            onDismiss?()
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Text input field
            TextField("What needs to be done?", text: $inputText, axis: .vertical)
                .font(.system(size: 17, weight: .regular))
                .foregroundColor(S2.Colors.primaryText)
                .focused($isFocused)
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 12)
                .lineLimit(1...5)
                .onSubmit {
                    createTask()
                }

            // Bottom row with buttons
            HStack(spacing: 12) {
                // Cancel button
                Button(action: {
                    resetComposer()
                }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(S2.Colors.secondaryText)
                        .frame(width: 40, height: 40)
                        .background(S2.Colors.secondarySurface)
                        .clipShape(Circle())
                }

                Spacer()

                // Create task button
                Button(action: {
                    createTask()
                }) {
                    ZStack {
                        Circle()
                            .fill(inputText.isEmpty ? S2.Colors.secondarySurface : Color.black)
                            .frame(width: 40, height: 40)

                        Image(systemName: "checkmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(inputText.isEmpty ? S2.Colors.tertiaryText : .white)
                    }
                }
                .disabled(inputText.isEmpty)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
        .background(S2.Colors.elevated)
        .clipShape(
            UnevenRoundedRectangle(
                topLeadingRadius: 24,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: 24
            )
        )
        .overlay(
            UnevenRoundedRectangle(
                topLeadingRadius: 24,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: 24
            )
            .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
        .gesture(
            DragGesture()
                .onEnded { value in
                    if value.translation.height > 50 {
                        resetComposer()
                    }
                }
        )
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: -4)
        .onAppear {
            // Auto-focus the text field when composer appears
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                isFocused = true
            }
        }
    }
}

// Helper to create uneven rounded rectangles
struct UnevenRoundedRectangle: Shape {
    var topLeadingRadius: CGFloat = 0
    var bottomLeadingRadius: CGFloat = 0
    var bottomTrailingRadius: CGFloat = 0
    var topTrailingRadius: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        var path = Path()

        let minX = rect.minX
        let minY = rect.minY
        let maxX = rect.maxX
        let maxY = rect.maxY

        // Start from top left
        path.move(to: CGPoint(x: minX + topLeadingRadius, y: minY))

        // Top edge
        path.addLine(to: CGPoint(x: maxX - topTrailingRadius, y: minY))

        // Top right corner
        path.addArc(
            center: CGPoint(x: maxX - topTrailingRadius, y: minY + topTrailingRadius),
            radius: topTrailingRadius,
            startAngle: Angle(degrees: -90),
            endAngle: Angle(degrees: 0),
            clockwise: false
        )

        // Right edge
        path.addLine(to: CGPoint(x: maxX, y: maxY - bottomTrailingRadius))

        // Bottom right corner
        path.addArc(
            center: CGPoint(x: maxX - bottomTrailingRadius, y: maxY - bottomTrailingRadius),
            radius: bottomTrailingRadius,
            startAngle: Angle(degrees: 0),
            endAngle: Angle(degrees: 90),
            clockwise: false
        )

        // Bottom edge
        path.addLine(to: CGPoint(x: minX + bottomLeadingRadius, y: maxY))

        // Bottom left corner
        path.addArc(
            center: CGPoint(x: minX + bottomLeadingRadius, y: maxY - bottomLeadingRadius),
            radius: bottomLeadingRadius,
            startAngle: Angle(degrees: 90),
            endAngle: Angle(degrees: 180),
            clockwise: false
        )

        // Left edge
        path.addLine(to: CGPoint(x: minX, y: minY + topLeadingRadius))

        // Top left corner
        path.addArc(
            center: CGPoint(x: minX + topLeadingRadius, y: minY + topLeadingRadius),
            radius: topLeadingRadius,
            startAngle: Angle(degrees: 180),
            endAngle: Angle(degrees: 270),
            clockwise: false
        )

        return path
    }
}

#Preview {
    VStack {
        Spacer()
        TaskComposerView()
    }
}
