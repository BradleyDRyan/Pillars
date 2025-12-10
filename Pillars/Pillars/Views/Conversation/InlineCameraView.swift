//
//  InlineCameraView.swift
//  Squirrel2
//
//  Inline camera view for voice mode
//

import SwiftUI
import AVFoundation

struct InlineCameraView: View {
    @Binding var capturedImage: UIImage?
    @Binding var isCapturing: Bool
    @Binding var isUploading: Bool
    let onSend: (UIImage) -> Void
    let onRetake: () -> Void
    let onClose: () -> Void
    @State private var cameraError: String?

    var body: some View {
        VStack(spacing: 12) {
            // Voice status indicator at top
            HStack {
                Image(systemName: "mic.fill")
                    .foregroundColor(.red)
                    .font(.squirrelCaption)
                Text("Voice Active")
                    .font(.squirrelCaption)
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Capsule().fill(Color.red.opacity(0.8)))

            // Camera view
            ZStack {
                cameraView

                // Upload overlay
                if isUploading {
                    uploadingOverlay
                }
            }
            .background(Color.black)
            .clipShape(RoundedRectangle(cornerRadius: 20))
        }
        .padding(.horizontal)
        .onChange(of: capturedImage) { _, newImage in
            // Automatically send when image is captured
            if let image = newImage {
                onSend(image)
            }
        }
    }

    private var cameraView: some View {
        VStack(spacing: 0) {
            // Camera preview - more compact
            CameraPreviewView(
                capturedImage: $capturedImage,
                isCapturing: $isCapturing,
                onError: { error in
                    cameraError = error
                }
            )
            .aspectRatio(1, contentMode: .fit)  // Square aspect ratio for compactness
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )

            // Capture button - smaller and integrated
            Button(action: {
                isCapturing = true
            }) {
                ZStack {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 50, height: 50)

                    Circle()
                        .stroke(Color.white.opacity(0.5), lineWidth: 2)
                        .frame(width: 58, height: 58)
                }
            }
            .disabled(isCapturing)
            .padding(.vertical, 20)
        }
    }


    private var uploadingOverlay: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                .scaleEffect(1.2)

            Text("Sending photo...")
                .font(.squirrelButtonSecondary)
                .foregroundColor(.white)
        }
        .padding(30)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.black.opacity(0.8))
        )
    }
}

#Preview {
    InlineCameraView(
        capturedImage: .constant(nil),
        isCapturing: .constant(false),
        isUploading: .constant(false),
        onSend: { _ in },
        onRetake: { },
        onClose: { }
    )
    .frame(maxHeight: 600)
    .background(Color.gray)
}