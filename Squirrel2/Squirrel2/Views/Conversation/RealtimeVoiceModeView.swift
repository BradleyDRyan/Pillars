//
//  RealtimeVoiceModeView.swift
//  Squirrel2
//
//  Created by Claude on 8/25/25.
//

import SwiftUI

struct RealtimeVoiceModeView: View {
    @StateObject private var voiceAI = VoiceAIManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var isRecording = false
    @State private var showError = false
    @State private var showCamera = false
    @State private var capturedImage: UIImage?
    @State private var isCapturingQuick = false
    @State private var useQuickCapture = true  // Toggle between quick and standard camera

    // Conversation ID for photo uploads
    private var conversationId: String {
        voiceAI.conversationId
    }
    
    var body: some View {
        ZStack {
            backgroundGradient
            
            mainContent
        }
        .alert("Error", isPresented: $showError) {
            Button("OK") { }
        } message: {
            Text(voiceAI.error ?? "An unknown error occurred")
        }
        .onChange(of: voiceAI.error) { _, newError in
            showError = newError != nil
        }
        .onChange(of: voiceAI.shouldDismiss) { _, shouldDismiss in
            if shouldDismiss {
                // Auto-dismiss after simple command
                Task {
                    await voiceAI.closeVoiceMode()
                    dismiss()
                }
            }
        }
        .onAppear {
            // Auto-start listening immediately
            Task {
                do {
                    // If not connected, connect now
                    if !voiceAI.isConnected {
                        try await voiceAI.startHandlingVoice()
                    }
                    
                    // Start listening immediately
                    try await voiceAI.startListening()
                    isRecording = true
                } catch {
                    voiceAI.error = error.localizedDescription
                    isRecording = false
                }
            }
        }
        .onDisappear {
            Task {
                await voiceAI.closeVoiceMode()
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            VoiceCameraView(
                isPresented: $showCamera,
                capturedImage: $capturedImage,
                conversationId: conversationId,
                useRealtimeMode: true,  // Enable realtime mode for voice AI photo questions
                autoSendMode: true,  // Auto-send for speed
                defaultQuestion: "Check this out!"  // Contextual default
            )
        }
    }
    
    private var backgroundGradient: some View {
        LinearGradient(
            colors: [S2.Colors.squirrelWarmBackground, S2.Colors.squirrelWarmGrayBackground],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }
    
    private var loadingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Setting up voice AI...")
                .font(.squirrelHeadline)
                .foregroundColor(S2.Colors.squirrelTextSecondary)
        }
    }
    
    private var mainContent: some View {
        VStack(spacing: 30) {
                    // Header
                    HStack {
                        Button("Cancel") {
                            Task {
                                await voiceAI.closeVoiceMode()
                                dismiss()
                            }
                        }
                        .foregroundColor(S2.Colors.squirrelTextSecondary)

                        Spacer()

                        Text("Voice Mode")
                            .font(.squirrelHeadline)
                            .foregroundColor(S2.Colors.squirrelTextPrimary)

                        Spacer()

                        HStack(spacing: 12) {
                            if useQuickCapture {
                                // Quick camera button with instant capture
                                QuickCameraButton(
                                    isCapturing: $isCapturingQuick,
                                    onCapture: { image in
                                        handleQuickCapture(image)
                                    }
                                )
                                .disabled(!voiceAI.isConnected)
                                .opacity(voiceAI.isConnected ? 1.0 : 0.5)
                            } else {
                                // Standard camera button
                                Button(action: {
                                    showCamera = true
                                }) {
                                    Image(systemName: "camera.fill")
                                        .font(.system(size: 20))
                                        .foregroundColor(voiceAI.isConnected ? S2.Colors.squirrelPrimary : S2.Colors.squirrelTextSecondary)
                                        .frame(width: 36, height: 36)
                                        .background(Circle().fill(Color.white))
                                        .shadow(radius: 2)
                                }
                                .disabled(!voiceAI.isConnected)
                                .opacity(voiceAI.isConnected ? 1.0 : 0.5)
                            }

                            // Connection status indicator
                            Circle()
                                .fill(voiceAI.isConnected ? Color.green : Color.red)
                                .frame(width: 10, height: 10)
                        }
                }
                .padding(.horizontal)
                .padding(.top)
                
                Spacer()
                
                // Current transcript display
                VStack(spacing: 20) {
                    // Show current status
                    if voiceAI.isListening {
                        HStack(spacing: 12) {
                            Image(systemName: "mic.fill")
                                .foregroundColor(.red)
                                .font(.title3)
                                .symbolEffect(.pulse)
                            Text("Listening...")
                                .font(.squirrelHeadline)
                                .foregroundColor(S2.Colors.squirrelTextPrimary)
                        }
                    } else if voiceAI.isConnected {
                        HStack(spacing: 12) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                                .font(.title3)
                            Text("Ready")
                                .font(.squirrelHeadline)
                                .foregroundColor(S2.Colors.squirrelTextPrimary)
                        }
                    }
                    
                    // Show current transcript
                    if !voiceAI.currentTranscript.isEmpty {
                        Text(voiceAI.currentTranscript)
                            .font(.squirrelBody)
                            .foregroundColor(S2.Colors.squirrelTextSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    
                    // Show last AI response (simplified)
                    if let lastAssistantMessage = voiceAI.messages.last(where: { $0.role != .user }) {
                        let content = lastAssistantMessage.content
                        
                        if !content.isEmpty {
                            Text(content)
                                .font(.squirrelBody)
                                .foregroundColor(S2.Colors.squirrelTextPrimary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                                .padding(.vertical, 16)
                                .background(S2.Colors.squirrelSurfaceBackground)
                                .cornerRadius(16)
                        }
                    }
                }
                .padding()
                .frame(maxHeight: 300)
                
                // Voice visualization
                if isRecording {
                    VoiceWaveformView()
                        .frame(height: 60)
                        .padding(.horizontal)
                }
                
                // Main recording button
                Button(action: toggleRecording) {
                    ZStack {
                        // Animated circles
                        if isRecording {
                            Circle()
                                .stroke(Color.red.opacity(0.3), lineWidth: 2)
                                .frame(width: 140, height: 140)
                                .scaleEffect(isRecording ? 1.2 : 1.0)
                                .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isRecording)
                            
                            Circle()
                                .stroke(Color.red.opacity(0.2), lineWidth: 2)
                                .frame(width: 160, height: 160)
                                .scaleEffect(isRecording ? 1.3 : 1.0)
                                .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: isRecording)
                        }
                        
                        // Main button
                        Circle()
                            .fill(isRecording ? Color.red : S2.Colors.squirrelPrimary)
                            .frame(width: 120, height: 120)
                            .overlay(
                                Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                                    .font(.system(size: 40))
                                    .foregroundColor(.white)
                            )
                            .scaleEffect(isRecording ? 1.1 : 1.0)
                            .animation(.easeInOut(duration: 0.2), value: isRecording)
                    }
                }
                .disabled(!voiceAI.isConnected && !isRecording)
                
                // Status text
                Text(statusText)
                    .font(.squirrelCallout)
                    .foregroundColor(S2.Colors.squirrelTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                
                // Interrupt button (only show when AI is speaking)
                if voiceAI.messages.last?.role == .assistant {
                    Button(action: {
                        Task {
                            await voiceAI.interrupt()
                        }
                    }) {
                        Text("Interrupt")
                            .font(.squirrelButtonSecondary)
                            .foregroundColor(S2.Colors.squirrelSecondary)
                    }
                }
                
                Spacer()
        }
    }
    
    private var statusText: String {
        if !voiceAI.isConnected {
            return "Connecting..."
        } else if isRecording {
            return "Listening... Tap to stop"
        } else {
            return "Tap to start speaking"
        }
    }
    
    private func toggleRecording() {
        Task {
            if isRecording {
                await voiceAI.stopListening()
                isRecording = false
            } else {
                do {
                    try await voiceAI.startListening()
                    isRecording = true
                } catch {
                    print("Error starting recording: \(error)")
                    voiceAI.error = error.localizedDescription
                }
            }
        }
    }

    private func handleQuickCapture(_ image: UIImage) {
        Task {
            do {
                // Instantly send the photo with a contextual message
                guard let imageData = image.jpegData(compressionQuality: 0.5) else { return }

                // Send with minimal context for speed
                try await voiceAI.sendImageQuestion(
                    imageData: imageData,
                    text: "What do you see?"
                )

                // Quick haptic feedback for success
                let notification = UINotificationFeedbackGenerator()
                notification.notificationOccurred(.success)
            } catch {
                voiceAI.error = "Failed to send photo: \(error.localizedDescription)"
            }
        }
    }
}

// Animated waveform visualization
struct VoiceWaveformView: View {
    @State private var amplitudes: [CGFloat] = Array(repeating: 0.2, count: 20)
    @State private var timer: Timer?
    
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<amplitudes.count, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.red)
                    .frame(width: 4, height: CGFloat.random(in: 10...40))
                    .animation(.easeInOut(duration: 0.3), value: amplitudes[index])
            }
        }
        .onAppear {
            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
                amplitudes = amplitudes.map { _ in CGFloat.random(in: 0.2...1.0) * 40 }
            }
        }
        .onDisappear {
            timer?.invalidate()
        }
    }
}

#Preview {
    RealtimeVoiceModeView()
}
