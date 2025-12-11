//
//  FirebaseManager.swift
//  Squirrel2
//
//  Firebase integration manager with phone authentication
//

import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage

class FirebaseManager: ObservableObject {
    static let shared = FirebaseManager()
    
    @Published var isAuthenticated = false
    @Published var isReady = false
    @Published var currentUser: FirebaseAuth.User?
    
    private var auth: Auth?
    private var firestore: Firestore?
    private var storage: Storage?
    private var authStateListener: AuthStateDidChangeListenerHandle?
    
    init() {
        setupFirebase()
    }
    
    private func setupFirebase() {
        // Firebase should already be configured in the App init
        guard let app = FirebaseApp.app() else {
            print("❌ ERROR: Firebase not configured. Please check GoogleService-Info.plist and app initialization")
            return
        }
        
        print("✅ Firebase configured successfully")
        print("📱 App Name: \(app.name)")
        print("🔑 Project ID: \(app.options.projectID ?? "nil")")
        print("📦 Bundle ID: \(app.options.bundleID ?? "nil")")
        print("🔗 API Key: \(app.options.apiKey ?? "nil")")
        print("🗄️ Storage Bucket: \(app.options.storageBucket ?? "nil")")
        print("🆔 Google App ID: \(app.options.googleAppID ?? "nil")")

        // WARNING if using wrong project
        if app.options.projectID == "squirrel-2" {
            print("⚠️ WARNING: Using OLD Firebase project 'squirrel-2'")
            print("⚠️ Backend expects 'connections-3f798'")
            print("⚠️ Please update GoogleService-Info.plist from Firebase Console")
        }
        
        self.auth = Auth.auth()
        self.firestore = Firestore.firestore()
        self.storage = Storage.storage()
        
        print("✅ Auth initialized: \(auth != nil)")
        print("✅ Firestore initialized: \(firestore != nil)")
        print("✅ Storage initialized: \(storage != nil)")
        
        // Configure auth settings
        configureAuthSettings()
        
        // Listen for auth state changes
        if let auth = auth {
            authStateListener = auth.addStateDidChangeListener { [weak self] _, user in
                DispatchQueue.main.async {
                    self?.currentUser = user
                    self?.isAuthenticated = user != nil
                    
                    if let user = user {
                        print("✅ Auth state changed - User: \(user.uid), Phone: \(user.phoneNumber ?? "none")")
                    } else {
                        print("📱 Auth state changed - No user signed in")
                    }
                }
            }
        }
        
        // Mark as ready
        DispatchQueue.main.async {
            self.isReady = true
            print("✅ FirebaseManager is ready")
        }
    }
    
    private func configureAuthSettings() {
        guard let auth = auth else { return }
        
        // Configure for testing - skip app verification in debug
        #if DEBUG
        auth.settings?.isAppVerificationDisabledForTesting = true
        print("✅ Auth settings configured - isAppVerificationDisabledForTesting: \(auth.settings?.isAppVerificationDisabledForTesting ?? false)")
        #endif
        
        // Set language code
        auth.languageCode = Locale.current.language.languageCode?.identifier
    }
    
    // Sign in anonymously
    func signInAnonymously() async throws {
        guard let auth = auth else {
            throw FirebaseError.firebaseNotConfigured
        }
        
        let result = try await auth.signInAnonymously()
        print("✅ Anonymous auth successful: \(result.user.uid)")
    }
    
    // Verification ID from Firebase Phone Auth
    private var verificationID: String?
    
    // Send verification code using Firebase Phone Auth
    @MainActor
    func sendVerificationCode(to phoneNumber: String) async throws {
        guard let auth = auth else {
            throw FirebaseError.firebaseNotConfigured
        }
        
        print("📞 Sending verification code to: \(phoneNumber)")
        print("📞 Auth settings: \(String(describing: auth.settings))")
        print("📞 isAppVerificationDisabledForTesting: \(auth.settings?.isAppVerificationDisabledForTesting ?? false)")
        
        do {
            let verificationID = try await PhoneAuthProvider.provider().verifyPhoneNumber(
                phoneNumber,
                uiDelegate: nil
            )
            self.verificationID = verificationID
            print("✅ Verification code sent, ID: \(verificationID)")
        } catch {
            print("❌ Phone auth error: \(error)")
            throw error
        }
    }
    
    // Verify the SMS code
    func verifyCode(_ code: String) async throws {
        guard let auth = auth else {
            throw FirebaseError.firebaseNotConfigured
        }
        
        guard let verificationID = verificationID else {
            throw FirebaseError.missingVerificationID
        }
        
        let credential = PhoneAuthProvider.provider().credential(
            withVerificationID: verificationID,
            verificationCode: code
        )
        
        try await auth.signIn(with: credential)
        self.verificationID = nil
        print("✅ Signed in successfully")
    }
    
    func signOut() throws {
        guard let auth = auth else {
            throw FirebaseError.firebaseNotConfigured
        }
        try auth.signOut()
        verificationID = nil
    }
    
    func fetchUserData(userId: String) async throws -> [String: Any]? {
        guard let firestore = firestore else {
            throw FirebaseError.firebaseNotConfigured
        }
        let document = try await firestore.collection("users").document(userId).getDocument()
        return document.data()
    }
    
    func updateUserData(userId: String, data: [String: Any]) async throws {
        guard let firestore = firestore else {
            throw FirebaseError.firebaseNotConfigured
        }
        try await firestore.collection("users").document(userId).setData(data, merge: true)
    }
    
    deinit {
        if let authStateListener = authStateListener {
            auth?.removeStateDidChangeListener(authStateListener)
        }
    }
}

enum FirebaseError: LocalizedError {
    case missingVerificationID
    case firebaseNotConfigured
    
    var errorDescription: String? {
        switch self {
        case .missingVerificationID:
            return "Session expired. Please request a new code."
        case .firebaseNotConfigured:
            return "Firebase is not properly configured."
        }
    }
}

