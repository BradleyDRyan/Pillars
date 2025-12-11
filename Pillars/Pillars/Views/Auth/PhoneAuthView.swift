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
    @State private var verificationID: String?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showVerificationField = false
    
    var body: some View {
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
                        verificationID = nil
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
            
            // Skip button for anonymous auth
            Button {
                Task { await signInAnonymously() }
            } label: {
                Text("Continue without account")
                    .font(.system(size: 15))
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 32)
        }
        .background(Color(UIColor.systemBackground))
    }
    
    // MARK: - Auth Methods
    
    private func sendVerificationCode() async {
        isLoading = true
        errorMessage = nil
        
        // Format phone number
        let formattedNumber = phoneNumber.hasPrefix("+") ? phoneNumber : "+1\(phoneNumber.filter { $0.isNumber })"
        
        do {
            verificationID = try await PhoneAuthProvider.provider().verifyPhoneNumber(formattedNumber, uiDelegate: nil)
            showVerificationField = true
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func verifyCode() async {
        guard let verificationID = verificationID else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            let credential = PhoneAuthProvider.provider().credential(
                withVerificationID: verificationID,
                verificationCode: verificationCode
            )
            try await Auth.auth().signIn(with: credential)
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func signInAnonymously() async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await Auth.auth().signInAnonymously()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
}

#Preview {
    PhoneAuthView()
        .environmentObject(FirebaseManager.shared)
}
