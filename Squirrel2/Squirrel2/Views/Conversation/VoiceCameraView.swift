//
//  VoiceCameraView.swift
//  Squirrel2
//
//  Camera view optimized for voice mode photo capture
//

import SwiftUI
import AVFoundation
import FirebaseAuth

struct VoiceCameraView: View {
    @Binding var isPresented: Bool
    @Binding var capturedImage: UIImage?
    let conversationId: String
    var useRealtimeMode: Bool = false  // Flag to use realtime voice API instead of standard upload
    var autoSendMode: Bool = true  // Skip preview, send immediately
    var defaultQuestion: String = "What do you think?"  // Default contextual question
    @State private var isCapturing = false
    @State private var showPreview = false
    @State private var isUploading = false
    @State private var error: String?
    @State private var showError = false
    @State private var questionText = "What's in this image?"  // Default question for the image

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if showPreview, let image = capturedImage {
                // Photo preview
                photoPreview(image: image)
            } else {
                // Camera view
                cameraView
            }

            // Overlays
            if isUploading {
                uploadingOverlay
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK") { }
        } message: {
            Text(error ?? "An unknown error occurred")
        }
        .onChange(of: error) { _, newError in
            showError = newError != nil
        }
    }

    private var cameraView: some View {
        VStack(spacing: 0) {
            // Header with close button
            HStack {
                Button(action: {
                    isPresented = false
                }) {
                    Image(systemName: "xmark")
                        .font(.title2)
                        .foregroundColor(.white)
                        .padding()
                        .background(Circle().fill(Color.black.opacity(0.5)))
                }
                Spacer()
            }
            .padding()

            // Camera preview
            CameraPreviewView(
                capturedImage: $capturedImage,
                isCapturing: $isCapturing,
                onError: { errorMessage in
                    error = errorMessage
                }
            )
            .ignoresSafeArea()
            .onChange(of: capturedImage) { _, newImage in
                if newImage != nil {
                    if autoSendMode && useRealtimeMode {
                        // Auto-send immediately without preview
                        Task {
                            await uploadPhoto(newImage!)
                        }
                    } else {
                        showPreview = true
                    }
                }
            }

            // Capture button
            VStack {
                Button(action: capturePhoto) {
                    ZStack {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 70, height: 70)

                        Circle()
                            .stroke(Color.white, lineWidth: 3)
                            .frame(width: 80, height: 80)
                    }
                }
                .disabled(isCapturing)
                .padding(.bottom, 40)
            }
            .frame(height: 150)
            .background(
                LinearGradient(
                    colors: [Color.black.opacity(0), Color.black.opacity(0.8)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
    }

    private func photoPreview(image: UIImage) -> some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button(action: retakePhoto) {
                    Text("Retake")
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color.white.opacity(0.2)))
                }

                Spacer()

                Button(action: {
                    isPresented = false
                }) {
                    Image(systemName: "xmark")
                        .font(.title2)
                        .foregroundColor(.white)
                        .padding()
                        .background(Circle().fill(Color.black.opacity(0.5)))
                }
            }
            .padding()

            // Image preview
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxHeight: .infinity)

            // Question input and send button
            VStack(spacing: 15) {
                // Text field for question (only in realtime mode)
                if useRealtimeMode {
                    TextField("Ask about this image...", text: $questionText)
                        .font(.squirrelBody)
                        .foregroundColor(.white)
                        .padding(12)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.white.opacity(0.15))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.white.opacity(0.3), lineWidth: 1)
                        )
                        .padding(.horizontal, 20)
                }

                Button(action: sendPhoto) {
                    HStack {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                        Text(useRealtimeMode ? "Ask AI" : "Send Photo")
                            .font(.squirrelButtonPrimary)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 30)
                    .padding(.vertical, 15)
                    .background(Capsule().fill(S2.Colors.squirrelPrimary))
                }
                .disabled(isUploading)
                .padding(.bottom, 40)
            }
            .frame(height: 150)
            .background(
                LinearGradient(
                    colors: [Color.black.opacity(0), Color.black.opacity(0.8)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
    }

    private var uploadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.6)
                .ignoresSafeArea()

            VStack(spacing: 20) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.white)

                Text("Sending photo...")
                    .font(.squirrelHeadline)
                    .foregroundColor(.white)
            }
            .padding(40)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.black.opacity(0.8))
            )
        }
    }

    private func capturePhoto() {
        isCapturing = true
    }

    private func retakePhoto() {
        capturedImage = nil
        showPreview = false
    }

    private func sendPhoto() {
        guard let image = capturedImage else { return }

        Task {
            await uploadPhoto(image)
        }
    }

    private func uploadPhoto(_ image: UIImage) async {
        isUploading = true

        do {
            if useRealtimeMode {
                // Send via realtime voice API with optimized compression
                // Lower quality for faster transmission (0.5 is still good for most uses)
                guard let imageData = image.jpegData(compressionQuality: 0.5) else {
                    throw NSError(domain: "Image", code: 0, userInfo: [NSLocalizedDescriptionKey: "Failed to process image"])
                }

                // Send to VoiceAIManager with contextual default
                let question = autoSendMode ? defaultQuestion : (questionText.isEmpty ? "What's in this image?" : questionText)
                try await VoiceAIManager.shared.sendImageQuestion(
                    imageData: imageData,
                    text: question
                )

                print("Photo sent to realtime API with question: \(questionText)")

                // Dismiss camera view
                await MainActor.run {
                    isUploading = false
                    isPresented = false
                }
            } else {
                // Standard upload via API
                // Get auth token
                guard let user = Auth.auth().currentUser else {
                    throw NSError(domain: "Auth", code: 0, userInfo: [NSLocalizedDescriptionKey: "Not authenticated"])
                }

                let token = try await user.getIDToken()
                APIService.shared.setAuthToken(token)

                // Upload photo with conversation ID
                let response = try await APIService.shared.uploadPhoto(image, conversationId: conversationId) { progress in
                    print("Upload progress: \(progress)")
                }

                print("Photo uploaded successfully: \(response.entryId)")

                // Dismiss camera view
                await MainActor.run {
                    isUploading = false
                    isPresented = false
                }
            }
        } catch {
            await MainActor.run {
                isUploading = false
                self.error = error.localizedDescription
            }
        }
    }
}

#Preview {
    VoiceCameraView(
        isPresented: .constant(true),
        capturedImage: .constant(nil),
        conversationId: "preview-conversation"
    )
}
