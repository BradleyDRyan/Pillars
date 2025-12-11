//
//  PhoneAuthView.swift
//  Pillars
//
//  Phone number authentication view
//

import SwiftUI
import FirebaseAuth

struct PhoneAuthView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var phoneNumber = ""
    @State private var verificationCode = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showVerificationField = false
    
    var body: some View {
        Group {
            if !firebaseManager.isReady {
                // Loading while Firebase initializes
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("Loading...")
                        .font(.system(size: 15))
                        .foregroundColor(.secondary)
                }
            } else {
                authContent
            }
        }
        .background(Color(UIColor.systemBackground))
    }
    
    private var authContent: some View {
        VStack(spacing: 32) {
            Spacer()
            
            // Logo/Header
            VStack(spacing: 16) {
                Image(systemName: "building.columns.fill")
                    .font(.system(size: 64))
                    .foregroundColor(.primary)
                
                Text("Pillars")
                    .font(.system(size: 34, weight: .bold))
                
                Text("Build your life on solid ground")
                    .font(.system(size: 17))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Auth form
            VStack(spacing: 20) {
                if !showVerificationField {
                    // Phone number input
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Phone Number")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.secondary)
                        
                        TextField("+1 (555) 123-4567", text: $phoneNumber)
                            .font(.system(size: 17))
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .padding(16)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                    }
                    
                    Button {
                        Task { await sendVerificationCode() }
                    } label: {
                        HStack {
                            if isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Continue")
                            }
                        }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(16)
                        .background(phoneNumber.count >= 10 ? Color.blue : Color.gray)
                        .cornerRadius(12)
                    }
                    .disabled(phoneNumber.count < 10 || isLoading)
                } else {
                    // Verification code input
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Verification Code")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.secondary)
                        
                        TextField("123456", text: $verificationCode)
                            .font(.system(size: 24, weight: .medium, design: .monospaced))
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .multilineTextAlignment(.center)
                            .padding(16)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                    }
                    
                    Button {
                        Task { await verifyCode() }
                    } label: {
                        HStack {
                            if isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Verify")
                            }
                        }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(16)
                        .background(verificationCode.count == 6 ? Color.blue : Color.gray)
                        .cornerRadius(12)
                    }
                    .disabled(verificationCode.count != 6 || isLoading)
                    
                    Button {
                        showVerificationField = false
                        verificationCode = ""
                    } label: {
                        Text("Use a different number")
                            .font(.system(size: 15))
                            .foregroundColor(.blue)
                    }
                }
                
                if let error = errorMessage {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 24)
            
            Spacer()
        }
    }
    
    // MARK: - Auth Methods
    
    private func sendVerificationCode() async {
        isLoading = true
        errorMessage = nil
        
        // Format phone number
        let formattedNumber = phoneNumber.hasPrefix("+") ? phoneNumber : "+1\(phoneNumber.filter { $0.isNumber })"
        
        do {
            try await firebaseManager.sendVerificationCode(to: formattedNumber)
            showVerificationField = true
        } catch {
            print("❌ Phone auth error: \(error)")
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func verifyCode() async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await firebaseManager.verifyCode(verificationCode)
        } catch {
            print("❌ Verification error: \(error)")
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
}

#Preview {
    PhoneAuthView()
        .environmentObject(FirebaseManager.shared)
}
