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
    @Published var isCheckingOnboardingStatus = false
    @Published var hasCompletedOnboarding = false
    @Published var currentUser: FirebaseAuth.User?
    
    private var auth: Auth?
    private var firestore: Firestore?
    private var storage: Storage?
    private var authStateListener: AuthStateDidChangeListenerHandle?
    
    init() {
        setupFirebase()
    }
    
    private func setupFirebase() {
        // Firebase is configured in AppDelegate.didFinishLaunchingWithOptions
        // By the time FirebaseManager is created, Firebase should already be ready
        guard let app = FirebaseApp.app() else {
            print("❌ ERROR: Firebase not configured. AppDelegate should configure Firebase before FirebaseManager is created.")
            return
        }
        
        print("✅ FirebaseManager: Firebase already configured")
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
                        self?.isCheckingOnboardingStatus = true
                        self?.hasCompletedOnboarding = false
                        print("✅ Auth state changed - User: \(user.uid), Phone: \(user.phoneNumber ?? "none")")
                        
                        // Ensure user data is saved to Firestore and check onboarding status
                        Task {
                            await self?.saveUserToFirestore(user: user)
                            await self?.checkOnboardingStatus(userId: user.uid)
                        }
                    } else {
                        print("📱 Auth state changed - No user signed in")
                        self?.isCheckingOnboardingStatus = false
                        self?.hasCompletedOnboarding = false
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
        
        // Note: isAppVerificationDisabledForTesting only works on SIMULATOR
        // On real device, Firebase uses reCAPTCHA fallback when APNs is not available
        
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
        
        // Debug: Print ALL Firebase configuration
        print("📞 ====== FIREBASE DEBUG ======")
        print("📞 Phone number: \(phoneNumber)")
        print("📞 Auth: \(auth)")
        print("📞 Auth.app: \(String(describing: auth.app))")
        print("📞 Auth.app.name: \(auth.app?.name ?? "nil")")
        print("📞 Auth.app.options.projectID: \(auth.app?.options.projectID ?? "nil")")
        print("📞 Auth.app.options.googleAppID: \(auth.app?.options.googleAppID ?? "nil")")
        print("📞 Auth.app.options.apiKey: \(auth.app?.options.apiKey ?? "nil")")
        print("📞 Auth.app.options.clientID: \(auth.app?.options.clientID ?? "nil")")  // <-- LIKELY THE ISSUE
        print("📞 Auth.app.options.bundleID: \(auth.app?.options.bundleID ?? "nil")")
        print("📞 Auth settings: \(String(describing: auth.settings))")
        print("📞 isAppVerificationDisabledForTesting: \(auth.settings?.isAppVerificationDisabledForTesting ?? false)")
        print("📞 ==============================")
        
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
    
    // Verify the SMS code and save user data to Firestore
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
        
        let result = try await auth.signIn(with: credential)
        self.verificationID = nil
        print("✅ Signed in successfully")
        
        // Save user data to Firestore (including phone number for Twilio)
        await saveUserToFirestore(user: result.user)
    }
    
    // Save user data to Firestore after authentication
    private func saveUserToFirestore(user: FirebaseAuth.User) async {
        guard let firestore = firestore else {
            print("❌ Firestore not initialized, cannot save user")
            return
        }
        
        let userId = user.uid
        let phoneNumber = user.phoneNumber
        
        var userData: [String: Any] = [
            "uid": userId,
            "lastSignIn": FieldValue.serverTimestamp(),
            "updatedAt": FieldValue.serverTimestamp()
        ]
        
        // Add phone number if available (required for Twilio)
        if let phone = phoneNumber {
            userData["phoneNumber"] = phone
            print("📱 Saving phone number to Firestore: \(phone)")
        }
        
        do {
            // Use merge to preserve existing user data
            try await firestore.collection("users").document(userId).setData(userData, merge: true)
            print("✅ User data saved to Firestore: \(userId)")
        } catch {
            print("❌ Failed to save user to Firestore: \(error)")
        }
    }
    
    func signOut() throws {
        guard let auth = auth else {
            throw FirebaseError.firebaseNotConfigured
        }
        try auth.signOut()
        verificationID = nil
        isCheckingOnboardingStatus = false
        hasCompletedOnboarding = false
    }
    
    // MARK: - Onboarding

    struct OnboardingPillarSelection: Hashable {
        let name: String
        let pillarType: String
        let iconToken: String?
        let colorToken: String?
    }
    
    /// Check if user has completed onboarding
    @MainActor
    private func checkOnboardingStatus(userId: String) async {
        guard let firestore = firestore else {
            self.isCheckingOnboardingStatus = false
            return
        }
        defer { self.isCheckingOnboardingStatus = false }
        
        do {
            let document = try await firestore.collection("users").document(userId).getDocument()
            let completed = document.data()?["hasCompletedOnboarding"] as? Bool ?? false
            self.hasCompletedOnboarding = completed
            print("📋 Onboarding status: \(completed ? "completed" : "not completed")")
        } catch {
            print("❌ Failed to check onboarding status: \(error)")
            self.hasCompletedOnboarding = false
        }
    }
    
    /// Complete onboarding and save selected pillar and principles
    @MainActor
    func completeOnboarding(
        selectedPillar: String,
        pillarColor: String = "#007AFF",
        principles: [String] = [],
        pillarType: PillarType? = nil
    ) async {
        guard let firestore = firestore,
              let userId = currentUser?.uid else {
            print("❌ Cannot complete onboarding: missing firestore or user")
            return
        }
        
        do {
            // 1. Create the Pillar document through backend to ensure template-driven rubric defaults.
            let now = Timestamp(date: Date())
            let resolvedPillarType = pillarType
                ?? PillarType.resolve(selectedPillar)
                ?? PillarType.infer(name: selectedPillar, icon: nil)
            let createdPillar = try await APIService.shared.createPillar(
                name: selectedPillar,
                description: "",
                colorToken: PillarColorRegistry.token(forHex: pillarColor),
                iconToken: nil,
                pillarType: resolvedPillarType?.rawValue ?? "custom",
                isDefault: true
            )
            let pillarId = createdPillar.id
            print("✅ Created pillar '\(selectedPillar)' with id: \(pillarId)")
            
            // 2. Create Principle documents for each selected principle
            for (index, principleTitle) in principles.enumerated() {
                let principleId = UUID().uuidString
                let principleData: [String: Any] = [
                    "userId": userId,
                    "pillarId": pillarId,
                    "title": principleTitle,
                    "description": "",
                    "isActive": true,
                    "priority": max(5 - index, 1), // First principles get higher priority
                    "tags": [],
                    "createdAt": now,
                    "updatedAt": now
                ]
                
                try await firestore.collection("principles").document(principleId).setData(principleData)
                print("✅ Created principle '\(principleTitle)'")
            }
            
            // 3. Update user document with onboarding completion
            var userPatch: [String: Any] = [
                "hasCompletedOnboarding": true,
                "onboardingCompletedAt": FieldValue.serverTimestamp(),
                "initialPillar": selectedPillar,
                "initialPillarId": pillarId,
                "initialPrinciples": principles,
                "updatedAt": FieldValue.serverTimestamp()
            ]
            if let resolvedPillarType {
                userPatch["initialPillarType"] = resolvedPillarType.rawValue
            }
            try await firestore.collection("users").document(userId).setData(userPatch, merge: true)
            
            self.hasCompletedOnboarding = true
            print("✅ Onboarding completed with pillar: \(selectedPillar), \(principles.count) principles")
        } catch {
            print("❌ Failed to complete onboarding: \(error)")
        }
    }

    /// Complete onboarding by creating one pillar per selected template.
    @MainActor
    func completeOnboarding(selectedPillars: [OnboardingPillarSelection]) async throws {
        guard let firestore = firestore else {
            throw FirebaseError.firebaseNotConfigured
        }
        guard let userId = currentUser?.uid else {
            throw FirebaseError.notAuthenticated
        }

        let normalizedSelections = normalizeOnboardingSelections(selectedPillars)
        guard !normalizedSelections.isEmpty else {
            throw FirebaseError.invalidOnboardingSelection
        }

        var createdPillars: [(id: String, name: String, pillarType: String)] = []

        for (index, selection) in normalizedSelections.enumerated() {
            let resolvedIconToken = PillarIconRegistry.normalizeToken(selection.iconToken)
            let resolvedColorToken = PillarColorRegistry.normalizeToken(selection.colorToken)
                ?? PillarIconRegistry.defaultColorToken(for: resolvedIconToken)

            do {
                let createdPillar = try await APIService.shared.createPillar(
                    name: selection.name,
                    description: "",
                    colorToken: resolvedColorToken,
                    iconToken: resolvedIconToken,
                    pillarType: selection.pillarType,
                    isDefault: index == 0
                )

                createdPillars.append((
                    id: createdPillar.id,
                    name: selection.name,
                    pillarType: selection.pillarType
                ))
            } catch {
                print("⚠️ Failed to create onboarding pillar '\(selection.name)': \(error)")
            }
        }

        guard !createdPillars.isEmpty else {
            throw FirebaseError.onboardingFailed
        }

        let userPatch: [String: Any] = [
            "hasCompletedOnboarding": true,
            "onboardingCompletedAt": FieldValue.serverTimestamp(),
            "initialPillar": createdPillars[0].name,
            "initialPillarId": createdPillars[0].id,
            "initialPillarType": createdPillars[0].pillarType,
            "initialPillars": createdPillars.map { $0.name },
            "initialPillarIds": createdPillars.map { $0.id },
            "initialPillarTypes": createdPillars.map { $0.pillarType },
            "updatedAt": FieldValue.serverTimestamp()
        ]

        try await firestore.collection("users").document(userId).setData(userPatch, merge: true)
        hasCompletedOnboarding = true

        print("✅ Onboarding completed with \(createdPillars.count) pillars")
    }
    
    /// Reset onboarding for testing purposes
    @MainActor
    func resetOnboarding() async {
        guard let firestore = firestore,
              let userId = currentUser?.uid else {
            print("❌ Cannot reset onboarding: missing firestore or user")
            return
        }
        
        do {
            try await firestore.collection("users").document(userId).setData([
                "hasCompletedOnboarding": false,
                "updatedAt": FieldValue.serverTimestamp()
            ], merge: true)
            
            self.hasCompletedOnboarding = false
            print("🔄 Onboarding reset")
        } catch {
            print("❌ Failed to reset onboarding: \(error)")
        }
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

    // MARK: - Development Data Reset

    struct UserDataDeletionSummary {
        let deletedCounts: [String: Int]

        var totalDeleted: Int {
            deletedCounts.values.reduce(0, +)
        }
    }

    @MainActor
    func deleteAllUserDataForCurrentUser() async throws -> UserDataDeletionSummary {
        guard let firestore = firestore else {
            throw FirebaseError.firebaseNotConfigured
        }
        guard let userId = currentUser?.uid else {
            throw FirebaseError.notAuthenticated
        }

        // Keep this list aligned with user-scoped collections used across iOS.
        let userScopedCollections = [
            "pillars",
            "principles",
            "actions",
            "actionTemplates",
            "pointEvents",
            "insights",
            "blockTypes",
            // Legacy prelaunch collections retained for one-time cleanup.
            "todos",
            "habits",
            "habitLogs",
            "habitGroups",
            "dayBlocks",
            "dayTemplates"
        ]

        var deletedCounts: [String: Int] = [:]

        for collectionName in userScopedCollections {
            let deleted = try await deleteDocuments(
                inCollection: collectionName,
                forUserId: userId,
                firestore: firestore
            )
            if deleted > 0 {
                deletedCounts[collectionName] = deleted
            }
        }

        try await firestore.collection("users").document(userId).delete()
        deletedCounts["users"] = 1

        hasCompletedOnboarding = false
        isCheckingOnboardingStatus = false

        return UserDataDeletionSummary(deletedCounts: deletedCounts)
    }

    private func deleteDocuments(
        inCollection collectionName: String,
        forUserId userId: String,
        firestore: Firestore,
        batchSize: Int = 250
    ) async throws -> Int {
        var totalDeleted = 0

        while true {
            let snapshot = try await firestore.collection(collectionName)
                .whereField("userId", isEqualTo: userId)
                .limit(to: batchSize)
                .getDocuments()
            let docs = snapshot.documents
            guard !docs.isEmpty else { break }

            let batch = firestore.batch()
            for doc in docs {
                batch.deleteDocument(doc.reference)
            }
            try await batch.commit()
            totalDeleted += docs.count
        }

        return totalDeleted
    }

    private func normalizeOnboardingSelections(
        _ selections: [OnboardingPillarSelection]
    ) -> [OnboardingPillarSelection] {
        var seenTypes = Set<String>()
        var normalized: [OnboardingPillarSelection] = []

        for selection in selections {
            let trimmedName = selection.name.trimmingCharacters(in: .whitespacesAndNewlines)
            let trimmedType = selection.pillarType
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()

            guard !trimmedName.isEmpty else { continue }
            guard !trimmedType.isEmpty else { continue }
            guard !seenTypes.contains(trimmedType) else { continue }

            seenTypes.insert(trimmedType)
            normalized.append(
                OnboardingPillarSelection(
                    name: trimmedName,
                    pillarType: trimmedType,
                    iconToken: selection.iconToken,
                    colorToken: selection.colorToken
                )
            )
        }

        return normalized
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
    case notAuthenticated
    case invalidOnboardingSelection
    case onboardingFailed
    
    var errorDescription: String? {
        switch self {
        case .missingVerificationID:
            return "Session expired. Please request a new code."
        case .firebaseNotConfigured:
            return "Firebase is not properly configured."
        case .notAuthenticated:
            return "You must be signed in."
        case .invalidOnboardingSelection:
            return "Pick at least one focus area to continue."
        case .onboardingFailed:
            return "Failed to create pillars during onboarding."
        }
    }
}
