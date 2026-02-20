//
//  ProfileView.swift
//  Pillars
//
//  Profile tab - user settings and account info
//

import SwiftUI
import FirebaseAuth
import UIKit
import Security

struct ProfileView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var showingSignOutAlert = false
    @State private var showingRevokeApiKeyAlert = false
    @State private var isApiKeyLoading = false
    @State private var isApiKeyMutating = false
    @State private var hasApiKey = false
    @State private var apiKeyValue: String?
    @State private var apiKeyPrefix: String?
    @State private var apiKeyCreatedAt: String?
    @State private var apiKeyLastUsedAt: String?
    @State private var apiKeyErrorMessage: String?
    @State private var didCopyApiKey = false
    @State private var didCopyOpenClawSetup = false
    
    var body: some View {
        NavigationStack {
            List {
                // Profile header section
                Section {
                    HStack(spacing: 16) {
                        // Avatar
                        Circle()
                            .fill(Color.blue.opacity(0.2))
                            .frame(width: 64, height: 64)
                            .overlay {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 28))
                                    .foregroundColor(.blue)
                            }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            if firebaseManager.currentUser?.isAnonymous == true {
                                Text("Guest User")
                                    .font(.system(size: 18, weight: .semibold))
                                Text("Anonymous Account")
                                    .font(.system(size: 14))
                                    .foregroundColor(.secondary)
                            } else if let phoneNumber = firebaseManager.currentUser?.phoneNumber {
                                Text(phoneNumber)
                                    .font(.system(size: 18, weight: .semibold))
                                Text("Phone Account")
                                    .font(.system(size: 14))
                                    .foregroundColor(.secondary)
                            } else {
                                Text("User")
                                    .font(.system(size: 18, weight: .semibold))
                            }
                        }
                        
                        Spacer()
                    }
                    .padding(.vertical, 8)
                }
                
                // Account section
                Section("Account") {
                    HStack {
                        Label("User ID", systemImage: "person.text.rectangle")
                        Spacer()
                        Text(firebaseManager.currentUser?.uid.prefix(8) ?? "—")
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                    
                    if firebaseManager.currentUser?.isAnonymous == true {
                        HStack {
                            Label("Account Type", systemImage: "person.crop.circle.badge.questionmark")
                            Spacer()
                            Text("Anonymous")
                                .font(.system(size: 13))
                                .foregroundColor(.orange)
                        }
                    }
                }

                // API access section
                Section("API Access") {
                    HStack {
                        Label("Status", systemImage: "key.fill")
                        Spacer()
                        Text(hasApiKey ? "Active" : "Not Set")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(hasApiKey ? .green : .secondary)
                    }

                    if isApiKeyLoading || isApiKeyMutating {
                        HStack(spacing: 10) {
                            ProgressView()
                                .controlSize(.small)
                            Text("Syncing API key…")
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }
                    }

                    if let apiKeyValue {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(apiKeyValue)
                                .font(.system(size: 12, design: .monospaced))
                                .textSelection(.enabled)
                                .lineLimit(3)

                            Button {
                                UIPasteboard.general.string = apiKeyValue
                                didCopyApiKey = true
                                Task {
                                    try? await Task.sleep(nanoseconds: 1_500_000_000)
                                    didCopyApiKey = false
                                }
                            } label: {
                                Label(didCopyApiKey ? "Copied" : "Copy API Key", systemImage: didCopyApiKey ? "checkmark.circle.fill" : "doc.on.doc")
                            }
                            .buttonStyle(.bordered)

                            Button {
                                UIPasteboard.general.string = makeOpenClawSetupMessage(apiKey: apiKeyValue)
                                didCopyOpenClawSetup = true
                                Task {
                                    try? await Task.sleep(nanoseconds: 1_500_000_000)
                                    didCopyOpenClawSetup = false
                                }
                            } label: {
                                Label(
                                    didCopyOpenClawSetup ? "Copied Setup Prompt" : "Copy OpenClaw Setup",
                                    systemImage: didCopyOpenClawSetup ? "checkmark.circle.fill" : "paperplane"
                                )
                            }
                            .buttonStyle(.bordered)
                        }
                    } else if hasApiKey {
                        Text("An API key already exists for this account. Tap Regenerate to issue a fresh key and reveal it on this device.")
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                    }

                    if let apiKeyPrefix {
                        HStack {
                            Label("Key Prefix", systemImage: "number")
                            Spacer()
                            Text(apiKeyPrefix)
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    }

                    if let apiKeyCreatedAt {
                        HStack {
                            Label("Created", systemImage: "calendar")
                            Spacer()
                            Text(formatApiTimestamp(apiKeyCreatedAt))
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }
                    }

                    if let apiKeyLastUsedAt {
                        HStack {
                            Label("Last Used", systemImage: "clock")
                            Spacer()
                            Text(formatApiTimestamp(apiKeyLastUsedAt))
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }
                    }

                    Button {
                        Task {
                            await createOrRotateApiKey()
                        }
                    } label: {
                        Label(hasApiKey ? "Regenerate API Key" : "Generate API Key", systemImage: hasApiKey ? "arrow.triangle.2.circlepath" : "plus.circle")
                    }
                    .disabled(isApiKeyMutating)

                    if hasApiKey {
                        Button(role: .destructive) {
                            showingRevokeApiKeyAlert = true
                        } label: {
                            Label("Revoke API Key", systemImage: "trash")
                        }
                        .disabled(isApiKeyMutating)
                    }

                    if let apiKeyErrorMessage {
                        Text(apiKeyErrorMessage)
                            .font(.system(size: 12))
                            .foregroundColor(.red)
                    }
                }
                
                // Preferences section
                Section("Preferences") {
                    NavigationLink {
                        Text("Notifications Settings")
                    } label: {
                        Label("Notifications", systemImage: "bell.badge")
                    }
                    
                    NavigationLink {
                        Text("Appearance Settings")
                    } label: {
                        Label("Appearance", systemImage: "paintbrush")
                    }
                    
                    NavigationLink {
                        Text("Privacy Settings")
                    } label: {
                        Label("Privacy", systemImage: "lock.shield")
                    }
                }
                
                // Debug section
                #if DEBUG
                Section("Developer") {
                    NavigationLink {
                        GlassPlayground()
                    } label: {
                        Label("Glass Playground", systemImage: "slider.horizontal.3")
                    }
                    
                    Button {
                        Task {
                            await firebaseManager.resetOnboarding()
                        }
                    } label: {
                        Label("Reset Onboarding", systemImage: "arrow.counterclockwise")
                    }
                }
                #endif
                
                // About section
                Section("About") {
                    HStack {
                        Label("Version", systemImage: "info.circle")
                        Spacer()
                        Text("2.0")
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Label("Backend", systemImage: "server.rack")
                        Spacer()
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 8, height: 8)
                            Text("Connected")
                                .font(.system(size: 13))
                                .foregroundColor(.green)
                        }
                    }
                }
                
                // Sign out section
                Section {
                    Button(role: .destructive) {
                        showingSignOutAlert = true
                    } label: {
                        HStack {
                            Spacer()
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
        }
        .alert("Sign Out", isPresented: $showingSignOutAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Sign Out", role: .destructive) {
                Task {
                    do {
                        try firebaseManager.signOut()
                    } catch {
                        print("Error signing out: \(error)")
                    }
                }
            }
        } message: {
            Text("Are you sure you want to sign out? Your anonymous account data may be lost.")
        }
        .alert("Revoke API Key", isPresented: $showingRevokeApiKeyAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Revoke", role: .destructive) {
                Task {
                    await revokeApiKey()
                }
            }
        } message: {
            Text("This immediately disables the current key. Any agent using it will stop working.")
        }
        .task(id: firebaseManager.currentUser?.uid) {
            await refreshApiKeyState()
        }
    }

    private func refreshApiKeyState() async {
        guard let userId = firebaseManager.currentUser?.uid else {
            hasApiKey = false
            apiKeyValue = nil
            apiKeyPrefix = nil
            apiKeyCreatedAt = nil
            apiKeyLastUsedAt = nil
            apiKeyErrorMessage = nil
            didCopyApiKey = false
            didCopyOpenClawSetup = false
            return
        }

        isApiKeyLoading = true
        apiKeyErrorMessage = nil
        defer { isApiKeyLoading = false }

        do {
            let metadata = try await fetchApiKeyMetadata()
            hasApiKey = metadata.hasKey
            apiKeyPrefix = metadata.keyPrefix
            apiKeyCreatedAt = metadata.createdAt
            apiKeyLastUsedAt = metadata.lastUsedAt
            apiKeyValue = metadata.hasKey ? APIKeyStore.load(userId: userId) : nil

            if !metadata.hasKey {
                APIKeyStore.delete(userId: userId)
            }
        } catch {
            apiKeyErrorMessage = error.localizedDescription
        }
    }

    private func createOrRotateApiKey() async {
        guard let userId = firebaseManager.currentUser?.uid else {
            apiKeyErrorMessage = "You must be signed in to manage an API key."
            return
        }

        isApiKeyMutating = true
        apiKeyErrorMessage = nil
        defer { isApiKeyMutating = false }

        do {
            let response = try await createApiKey()
            hasApiKey = true
            apiKeyValue = response.apiKey
            apiKeyPrefix = response.keyPrefix
            apiKeyCreatedAt = response.createdAt
            apiKeyLastUsedAt = nil
            didCopyApiKey = false
            APIKeyStore.save(response.apiKey, userId: userId)
        } catch {
            apiKeyErrorMessage = error.localizedDescription
        }
    }

    private func revokeApiKey() async {
        guard let userId = firebaseManager.currentUser?.uid else {
            apiKeyErrorMessage = "You must be signed in to revoke an API key."
            return
        }

        isApiKeyMutating = true
        apiKeyErrorMessage = nil
        defer { isApiKeyMutating = false }

        do {
            try await deleteApiKey()
            hasApiKey = false
            apiKeyValue = nil
            apiKeyPrefix = nil
            apiKeyCreatedAt = nil
            apiKeyLastUsedAt = nil
            didCopyApiKey = false
            didCopyOpenClawSetup = false
            APIKeyStore.delete(userId: userId)
        } catch {
            apiKeyErrorMessage = error.localizedDescription
        }
    }

    private func authorizedUsersRequest(path: String, method: String, body: Data? = nil) async throws -> (Data, HTTPURLResponse) {
        guard let user = Auth.auth().currentUser else {
            throw ProfileAPIError.notAuthenticated
        }
        guard let url = URL(string: "\(AppConfig.baseURL)/users\(path)") else {
            throw ProfileAPIError.invalidURL
        }

        let token = try await user.getIDToken()
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ProfileAPIError.invalidResponse
        }

        if (200...299).contains(httpResponse.statusCode) {
            return (data, httpResponse)
        }

        let backendMessage = (try? JSONDecoder().decode(BackendErrorPayload.self, from: data).error)
            ?? String(data: data, encoding: .utf8)
            ?? "Request failed"
        throw ProfileAPIError.server(httpResponse.statusCode, backendMessage)
    }

    private func fetchApiKeyMetadata() async throws -> APIKeyMetadataResponse {
        let (data, _) = try await authorizedUsersRequest(path: "/api-key", method: "GET")
        do {
            return try JSONDecoder().decode(APIKeyMetadataResponse.self, from: data)
        } catch {
            throw ProfileAPIError.decoding
        }
    }

    private func createApiKey() async throws -> APIKeyCreateResponse {
        let (data, _) = try await authorizedUsersRequest(path: "/api-key", method: "POST")
        do {
            return try JSONDecoder().decode(APIKeyCreateResponse.self, from: data)
        } catch {
            throw ProfileAPIError.decoding
        }
    }

    private func deleteApiKey() async throws {
        _ = try await authorizedUsersRequest(path: "/api-key", method: "DELETE")
    }

    private func formatApiTimestamp(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: value) {
            return date.formatted(date: .abbreviated, time: .shortened)
        }

        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: value) {
            return date.formatted(date: .abbreviated, time: .shortened)
        }

        return value
    }

    private func makeOpenClawSetupMessage(apiKey: String) -> String {
        """
        I'd like you to create/update my Pillars skill.

        1) Create a skill folder:
        skills/pillars_api

        2) Download the latest skill file:
        curl -fsSL https://pillars-phi.vercel.app/api/skills/openclaw/SKILL.md -o skills/pillars_api/SKILL.md

        3) Use this API key for my account:
        \(apiKey)
        """
    }
}

private struct APIKeyMetadataResponse: Decodable {
    let hasKey: Bool
    let keyPrefix: String?
    let createdAt: String?
    let rotatedAt: String?
    let lastUsedAt: String?
}

private struct APIKeyCreateResponse: Decodable {
    let apiKey: String
    let keyPrefix: String
    let createdAt: String
}

private struct BackendErrorPayload: Decodable {
    let error: String
}

private enum ProfileAPIError: LocalizedError {
    case notAuthenticated
    case invalidURL
    case invalidResponse
    case decoding
    case server(Int, String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be signed in."
        case .invalidURL:
            return "Invalid API URL."
        case .invalidResponse:
            return "Invalid server response."
        case .decoding:
            return "Failed to decode API response."
        case .server(let code, let message):
            return "API error (\(code)): \(message)"
        }
    }
}

private enum APIKeyStore {
    private static let service = "com.pillars.app.user-api-key"

    static func save(_ apiKey: String, userId: String) {
        guard let data = apiKey.data(using: .utf8) else { return }
        let account = "api-key.\(userId)"

        delete(userId: userId)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    static func load(userId: String) -> String? {
        let account = "api-key.\(userId)"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    static func delete(userId: String) {
        let account = "api-key.\(userId)"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

#Preview {
    ProfileView()
        .environmentObject(FirebaseManager.shared)
}
