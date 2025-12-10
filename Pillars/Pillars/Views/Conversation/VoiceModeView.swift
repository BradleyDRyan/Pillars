//
//  VoiceModeView.swift
//  Squirrel2
//
//  Voice mode with its own header, ring animation, and status
//

import SwiftUI
import FirebaseAuth

struct VoiceModeView: View {
    @ObservedObject var voiceAI: VoiceAIManager
    let onModeSwitch: () -> Void
    let onDismiss: () -> Void
    let onToggleVoice: () -> Void
    @State private var showCamera = false
    @State private var capturedImage: UIImage?
    @State private var isCapturing = false
    @State private var isUploading = false
    @State private var uploadError: String?
    @State private var showSettings = false

    var body: some View {
        VStack(spacing: 0) {
            // Voice mode header
            VoiceModeHeader(
                onDismiss: onDismiss,
                onModeSwitch: onModeSwitch,
                onCameraPress: {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        showCamera.toggle()
                        if !showCamera {
                            capturedImage = nil
                        }
                    }
                },
                onSettingsPress: {
                    showSettings = true
                },
                isConnected: voiceAI.isConnected,
                isCameraActive: showCamera
            )

            // Voice mode content
            ZStack {
                // Voice mode UI (always visible but dimmed when camera is active)
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
                .opacity(showCamera ? 0.3 : 1)  // Dim but still visible
                .scaleEffect(showCamera ? 0.7 : 1)  // Make smaller when camera is active
                .animation(.easeInOut(duration: 0.3), value: showCamera)

                // Camera view overlays on top when active
                if showCamera {
                    GeometryReader { geometry in
                        VStack {
                            Spacer()

                            InlineCameraView(
                                capturedImage: $capturedImage,
                                isCapturing: $isCapturing,
                                isUploading: $isUploading,
                                onSend: { image in
                                    Task {
                                        await uploadPhoto(image)
                                    }
                                },
                                onRetake: { }, // Not used anymore but kept for interface
                                onClose: {
                                    withAnimation(.easeInOut(duration: 0.3)) {
                                        showCamera = false
                                        capturedImage = nil
                                    }
                                }
                            )
                            .frame(maxHeight: geometry.size.height * 0.5) // Take up bottom half
                            .transition(.move(edge: .bottom).combined(with: .opacity))

                            Spacer(minLength: 50)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
        }
        .alert("Upload Error", isPresented: .constant(uploadError != nil)) {
            Button("OK") {
                uploadError = nil
            }
        } message: {
            Text(uploadError ?? "")
        }
        .sheet(isPresented: $showSettings) {
            VoiceSettingsView()
        }
    }

    private func uploadPhoto(_ image: UIImage) async {
        await MainActor.run {
            uploadError = nil
            isUploading = false // Keep overlay hidden while we process in the background
        }

        do {
            let maxRealtimeDimension: CGFloat = 768
            guard let scaledImage = image.scaledTo(maxDimension: maxRealtimeDimension),
                  let imageDataForAI = scaledImage.jpegData(compressionQuality: 0.6) else {
                throw NSError(
                    domain: "VoiceModeView",
                    code: 0,
                    userInfo: [NSLocalizedDescriptionKey: "Couldn't prepare photo data"]
                )
            }

            // Kick the photo to the realtime session first so acknowledgement starts immediately
            do {
                try await voiceAI.sendImageQuestion(
                    imageData: imageDataForAI,
                    shouldPersist: false
                )
            } catch {
                print("Failed to forward photo to AI session: \(error)")
                await MainActor.run {
                    uploadError = "Photo saved, but voice couldn't view it yet."
                }
            }

            // Reset immediately so the user can capture again
            await MainActor.run {
                capturedImage = nil
            }

            // Persist to backend quietly in the background
            Task {
                do {
                    guard let user = Auth.auth().currentUser else {
                        throw NSError(
                            domain: "Auth",
                            code: 0,
                            userInfo: [NSLocalizedDescriptionKey: "Not authenticated"]
                        )
                    }

                    let token = try await user.getIDToken()
                    APIService.shared.setAuthToken(token)

                    let response = try await APIService.shared.uploadPhoto(image, conversationId: voiceAI.conversationId) { progress in
                        print("Upload progress: \(progress)")
                    }

                    print("Photo uploaded successfully: \(response.entryId)")
                } catch {
                    print("Failed to persist photo to backend: \(error)")
                }
            }
        } catch {
            await MainActor.run {
                uploadError = error.localizedDescription
            }
        }
    }
}

// MARK: - Voice Mode Header
struct VoiceModeHeader: View {
    let onDismiss: () -> Void
    let onModeSwitch: () -> Void
    let onCameraPress: () -> Void
    let onSettingsPress: () -> Void
    let isConnected: Bool
    let isCameraActive: Bool

    var body: some View {
        HStack {
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.squirrelSubheadline)
                    .foregroundColor(.primary)
            }

            Spacer()

            Text(isCameraActive ? "Voice + Camera" : "Voice")
                .font(.squirrelHeadline)

            Spacer()

            // Camera button
            Button(action: onCameraPress) {
                Image(systemName: isCameraActive ? "mic.fill" : "camera.fill")
                    .font(.squirrelSubheadline)
                    .foregroundColor(isConnected ? .blue : .gray)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(isCameraActive ? Color.blue.opacity(0.1) : Color(.systemGray6)))
            }
            .disabled(!isConnected)
            .opacity(isConnected ? 1.0 : 0.5)
            .padding(.trailing, 4)

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
