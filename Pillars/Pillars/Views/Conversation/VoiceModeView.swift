//
//  VoiceModeView.swift
//  Squirrel2
//
//  Voice mode with its own header, ring animation, and status
//

import SwiftUI

struct VoiceModeView: View {
    @ObservedObject var voiceAI: VoiceAIManager
    let onModeSwitch: () -> Void
    let onDismiss: () -> Void
    let onToggleVoice: () -> Void
    @State private var showSettings = false

    var body: some View {
        VStack(spacing: 0) {
            // Voice mode header
            VoiceModeHeader(
                onDismiss: onDismiss,
                onModeSwitch: onModeSwitch,
                onSettingsPress: {
                    showSettings = true
                },
                isConnected: voiceAI.isConnected
            )

            // Voice mode content
            VStack {
                Spacer()

                // Voice mode ring animation
                VoiceRingAnimation(
                    isListening: voiceAI.isListening,
                    onToggle: onToggleVoice
                )

                // Voice mode status
                VoiceStatusIndicator(
                    isListening: voiceAI.isListening,
                    isConnected: voiceAI.isConnected
                )

                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
        }
        .sheet(isPresented: $showSettings) {
            VoiceSettingsView()
        }
    }
}

// MARK: - Voice Mode Header
struct VoiceModeHeader: View {
    let onDismiss: () -> Void
    let onModeSwitch: () -> Void
    let onSettingsPress: () -> Void
    let isConnected: Bool

    var body: some View {
        HStack {
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.squirrelSubheadline)
                    .foregroundColor(.primary)
            }

            Spacer()

            Text("Voice")
                .font(.squirrelHeadline)

            Spacer()

            // Settings button
            Button(action: onSettingsPress) {
                Image(systemName: "gearshape.fill")
                    .font(.squirrelSubheadline)
                    .foregroundColor(.blue)
            }
            .padding(.trailing, 8)

            Button(action: onModeSwitch) {
                Image(systemName: "text.bubble")
                    .font(.squirrelCallout)
                    .foregroundColor(.blue)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .overlay(
            Divider(),
            alignment: .bottom
        )
    }
}

// MARK: - Voice Ring Animation
struct VoiceRingAnimation: View {
    let isListening: Bool
    let onToggle: () -> Void

    var body: some View {
        ZStack {
            // Background pulse rings
            if isListening {
                Circle()
                    .stroke(Color.blue.opacity(0.2), lineWidth: 2)
                    .frame(width: 150, height: 150)
                    .scaleEffect(isListening ? 1.5 : 1)
                    .opacity(isListening ? 0 : 1)
                    .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false), value: isListening)

                Circle()
                    .stroke(Color.blue.opacity(0.3), lineWidth: 2)
                    .frame(width: 150, height: 150)
                    .scaleEffect(isListening ? 1.3 : 1)
                    .opacity(isListening ? 0 : 0.5)
                    .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false).delay(0.2), value: isListening)

                Circle()
                    .stroke(Color.blue.opacity(0.15), lineWidth: 2)
                    .frame(width: 150, height: 150)
                    .scaleEffect(isListening ? 1.7 : 1)
                    .opacity(isListening ? 0 : 0.3)
                    .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false).delay(0.4), value: isListening)
            }

            // Main voice button
            Button(action: onToggle) {
                ZStack {
                    Circle()
                        .fill(isListening ? Color.red : Color.blue)
                        .frame(width: 100, height: 100)
                        .shadow(color: .black.opacity(0.15), radius: 8, y: 4)

                    Image(systemName: isListening ? "stop.fill" : "mic.fill")
                        .font(.optimistic(size: 40, weight: .medium))
                        .foregroundColor(.white)
                }
            }
            .scaleEffect(isListening ? 1.1 : 1.0)
            .animation(.easeInOut(duration: 0.2), value: isListening)
        }
    }
}

// MARK: - Voice Status Indicator
struct VoiceStatusIndicator: View {
    let isListening: Bool
    let isConnected: Bool

    var body: some View {
        VStack(spacing: 20) {
            // Listening status
            if isListening {
                Text("Listening...")
                    .font(.squirrelCaption)
                    .foregroundColor(.secondary)
                    .transition(.opacity)
            }

            // Connection status
            HStack(spacing: 6) {
                Circle()
                    .fill(isConnected ? Color.green : Color.orange)
                    .frame(width: 6, height: 6)

                Text(isConnected ? "Connected" : "Connecting...")
                    .font(.squirrelFootnote)
                    .foregroundColor(.secondary)
            }
            .padding(.top, 40)
        }
    }
}
