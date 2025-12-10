//
//  QuickCameraButton.swift
//  Squirrel2
//
//  Ultra-fast camera capture for voice mode
//

import SwiftUI
import AVFoundation
import UIKit

struct QuickCameraButton: View {
    @Binding var isCapturing: Bool
    let onCapture: (UIImage) -> Void
    @State private var cameraSession: AVCaptureSession?
    @State private var photoOutput: AVCapturePhotoOutput?
    @State private var isFlashOn = false

    var body: some View {
        ZStack {
            // Camera button with instant capture
            Button(action: captureInstantly) {
                ZStack {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 56, height: 56)

                    Image(systemName: "camera.fill")
                        .font(.squirrelTitle2)
                        .foregroundColor(S2.Colors.squirrelPrimary)

                    // Flash indicator
                    if isFlashOn {
                        Circle()
                            .stroke(Color.yellow, lineWidth: 2)
                            .frame(width: 60, height: 60)
                    }
                }
            }
            .shadow(radius: 4)
            .scaleEffect(isCapturing ? 0.9 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: isCapturing)
        }
        .onAppear {
            setupCamera()
        }
        .onDisappear {
            cameraSession?.stopRunning()
        }
    }

    private func setupCamera() {
        DispatchQueue.global(qos: .userInitiated).async {
            let session = AVCaptureSession()
            session.sessionPreset = .photo

            guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                  let input = try? AVCaptureDeviceInput(device: camera) else {
                return
            }

            let output = AVCapturePhotoOutput()
            // Use smaller dimensions for faster capture
            if let maxDimensions = camera.activeFormat.supportedMaxPhotoDimensions.min(by: { $0.width < $1.width }) {
                output.maxPhotoDimensions = maxDimensions
            }
            output.maxPhotoQualityPrioritization = .speed // Prioritize speed

            if session.canAddInput(input) && session.canAddOutput(output) {
                session.addInput(input)
                session.addOutput(output)

                // Start session immediately for instant readiness
                session.startRunning()

                DispatchQueue.main.async {
                    self.cameraSession = session
                    self.photoOutput = output
                }
            }
        }
    }

    private func captureInstantly() {
        guard let photoOutput = photoOutput else { return }

        isCapturing = true

        // Haptic feedback for capture
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()

        // Configure for speed
        let settings = AVCapturePhotoSettings()
        // Use smaller dimensions for faster capture
        if let maxDimensions = photoOutput.maxPhotoDimensions as CMVideoDimensions? {
            settings.maxPhotoDimensions = maxDimensions
        }
        settings.flashMode = .off // No flash for speed

        // Use a simple delegate to handle the photo
        let delegate = QuickPhotoCaptureDelegate { image in
            DispatchQueue.main.async {
                self.isCapturing = false
                if let image = image {
                    // Resize image for faster transmission
                    let resized = image.resized(toWidth: 1024) // Reasonable size for AI analysis
                    onCapture(resized)
                }
            }
        }

        photoOutput.capturePhoto(with: settings, delegate: delegate)
    }
}

// Simple photo capture delegate
class QuickPhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let completion: (UIImage?) -> Void

    init(completion: @escaping (UIImage?) -> Void) {
        self.completion = completion
    }

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil,
              let data = photo.fileDataRepresentation(),
              let image = UIImage(data: data) else {
            completion(nil)
            return
        }
        completion(image)
    }
}

// Image resizing extension for faster uploads
extension UIImage {
    func resized(toWidth width: CGFloat) -> UIImage {
        let scale = width / self.size.width
        let newHeight = self.size.height * scale

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: newHeight))
        return renderer.image { _ in
            self.draw(in: CGRect(origin: .zero, size: CGSize(width: width, height: newHeight)))
        }
    }
}