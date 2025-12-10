//
//  VoiceAIManager.swift
//  Squirrel2
//
//  Created by Claude on 8/25/25.
//

import SwiftUI
import Combine
import FirebaseAuth
import WebRTC

@MainActor
class VoiceAIManager: ObservableObject {
    static let shared = VoiceAIManager()
    
    @Published var isListening = false
    @Published var isConnected = false
    @Published var messages: [Message] = []
    @Published var currentTranscript = ""
    @Published var error: String?
    @Published var lastFunctionCall: String?
    @Published var shouldDismiss = false
    @Published var isInitialized = false
    
    private var webRTCClient: VoiceWebRTCClient?
    private(set) var conversationId: String = ""
    private var cancellables = Set<AnyCancellable>()
    private var ephemeralToken: String?
    private var sessionId: String?
    private(set) var conversationViewModel: ConversationViewModel?

    // Get voice messages as Messages for unified conversation
    func getVoiceMessages() -> [Message] {
        return messages
    }

    // Set the conversation view model for message persistence
    func setConversationViewModel(_ viewModel: ConversationViewModel) {
        print("🔧 [VoiceAIManager] setConversationViewModel called")
        print("  - ViewModel conversation: \(viewModel.conversation?.id ?? "nil")")
        print("  - Previous conversationId: \(self.conversationId)")

        self.conversationViewModel = viewModel
        self.conversationId = viewModel.conversation?.id ?? ""

        print("  - New conversationId: \(self.conversationId)")
        print("  - ConversationViewModel stored: \(self.conversationViewModel != nil)")
    }

    
    // Persist a message to Firestore via backend API
    private func persistMessage(_ chatMessage: Message) async {
        print("🔵 [VoiceAIManager] persistMessage called with:")
        print("  - Content: \(chatMessage.content.prefix(50))...")
        print("  - Role: \(chatMessage.role.rawValue)")
        print("  - ConversationId in message: \(chatMessage.conversationId)")
        print("  - Current conversationId: \(conversationId)")
        print("  - ConversationViewModel exists: \(conversationViewModel != nil)")
        print("  - ConversationViewModel.conversation: \(conversationViewModel?.conversation?.id ?? "nil")")

        guard !conversationId.isEmpty,
              let user = Auth.auth().currentUser,
              let viewModel = conversationViewModel,
              viewModel.conversation != nil else {
            print("❌ [VoiceAIManager] Cannot persist message - missing requirements:")
            print("  - conversationId empty: \(conversationId.isEmpty)")
            print("  - user exists: \(Auth.auth().currentUser != nil)")
            print("  - viewModel exists: \(conversationViewModel != nil)")
            print("  - viewModel.conversation exists: \(conversationViewModel?.conversation != nil)")
            return
        }
        
        do {
            let token = try await user.getIDToken()
            
            // Send message via backend API directly
            guard let url = URL(string: "\(AppConfig.apiBaseURL)/conversations/\(conversationId)/messages") else {
                print("❌ [VoiceAIManager] Invalid URL for message persistence")
                return
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body: [String: Any] = [
                "content": chatMessage.content,
                "type": "text",
                "role": chatMessage.role.rawValue,
                "metadata": [
                    "source": "voice"
                ]
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            print("📤 [VoiceAIManager] Sending request to: \(url.absoluteString)")
            print("📤 [VoiceAIManager] Request body: \(String(data: request.httpBody ?? Data(), encoding: .utf8) ?? "nil")")
            
            let (responseData, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [VoiceAIManager] No HTTP response received")
                return
            }
            
            print("📥 [VoiceAIManager] Response status: \(httpResponse.statusCode)")
            if httpResponse.statusCode != 201 {
                print("❌ [VoiceAIManager] Failed to persist message")
                if let responseString = String(data: responseData, encoding: .utf8) {
                    print("❌ [VoiceAIManager] Error response: \(responseString)")
                }
                return
            }
            
            print("✅ [VoiceAIManager] Successfully persisted message to Firestore")
            if let responseString = String(data: responseData, encoding: .utf8) {
                print("✅ [VoiceAIManager] Response: \(responseString.prefix(200))")
            }
        } catch {
            print("❌ [VoiceAIManager] Failed to persist message: \(error)")
        }
    }
    
    
    private init() {
        setupComponents()
    }
    
    private func setupComponents() {
        webRTCClient = VoiceWebRTCClient()
        
        // Observe WebRTC messages
        webRTCClient?.messagePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] message in
                self?.handleRealtimeMessage(message)
            }
            .store(in: &cancellables)
    }
    
    func initialize(withChatHistory chatMessages: [Message] = [], conversationId: String) async {
        guard !isInitialized else { return }
        
        self.conversationId = conversationId
        self.messages = [] // Clear any previous messages
        
        // Store chat history for context
        self.chatHistory = chatMessages
        
        // Connect to backend WebSocket
        await connectToBackend()
        
        isInitialized = true
    }
    
    private var chatHistory: [Message] = []
    
    func updateChatHistory(_ messages: [Message], conversationId: String? = nil) async {
        self.chatHistory = messages
        if let conversationId = conversationId {
            self.conversationId = conversationId
        }
        
        // If already connected, update the session with new context
        if isConnected {
            await configureSession()
        }
    }
    
    // Public method to ensure initialization is complete
    func ensureInitialized() async {
        if !isConnected {
            await connectToBackend()
        }
        
        // Wait for connection to be ready
        for _ in 1...30 {
            if isConnected {
                return
            }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
    }
    
    private func connectToBackend() async {
        error = nil
        
        do {
            // Get ephemeral token from backend
            guard let firebaseUser = Auth.auth().currentUser else {
                throw VoiceAIError.notAuthenticated
            }
            
            let token = try await firebaseUser.getIDToken()
            let safeToken = token.sanitizedForHTTPHeader
            
            let urlString = "\(AppConfig.apiBaseURL)/realtime/token"
            print("🔑 Getting ephemeral token from: \(urlString)")
            guard let url = URL(string: urlString) else {
                throw VoiceAIError.invalidURL
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(safeToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            // Include voice settings from UserDefaults with proper defaults
            let storedVoice = UserDefaults.standard.string(forKey: "voiceSettings.voice") ?? "shimmer"
            // Valid voices for OpenAI Realtime API
            let validVoices = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]
            // Use stored voice if valid, otherwise default to shimmer
            let voice = validVoices.contains(storedVoice) ? storedVoice : "shimmer"

            // If we had to fallback, update UserDefaults
            if voice != storedVoice {
                UserDefaults.standard.set(voice, forKey: "voiceSettings.voice")
            }

            let vadThreshold = UserDefaults.standard.double(forKey: "voiceSettings.turnDetection.threshold")
            let silenceDuration = UserDefaults.standard.integer(forKey: "voiceSettings.turnDetection.silenceDuration")
            let prefixPadding = UserDefaults.standard.integer(forKey: "voiceSettings.turnDetection.prefixPadding")
            let speakingSpeed = UserDefaults.standard.string(forKey: "voiceSettings.speakingSpeed") ?? "fast"

            let voiceSettings: [String: Any] = [
                "voice": voice,
                "vadThreshold": vadThreshold > 0 ? vadThreshold : 0.5,
                "silenceDurationMs": silenceDuration > 0 ? silenceDuration : 500,
                "prefixPaddingMs": prefixPadding >= 0 ? prefixPadding : 300,
                "speakingSpeed": speakingSpeed
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: voiceSettings)

            let (data, response) = try await URLSession.shared.data(for: request)
            
            // Check if we got an HTTP error
            if let httpResponse = response as? HTTPURLResponse {
                print("🔑 Token response status: \(httpResponse.statusCode)")
                if httpResponse.statusCode != 200 {
                    let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
                    print("❌ Token error: \(errorText)")
                    throw VoiceAIError.invalidURL
                }
            }
            
            // Parse token response
            let tokenResponse = try JSONDecoder().decode(RealtimeTokenResponse.self, from: data)
            self.ephemeralToken = tokenResponse.token
            self.sessionId = tokenResponse.session_id
            
            print("✅ Got ephemeral token, session: \(tokenResponse.session_id)")
            
            // Connect WebRTC
            try await webRTCClient?.connect(token: tokenResponse.token, sessionId: tokenResponse.session_id)
            
            isConnected = webRTCClient?.isConnected ?? false
            
        } catch {
            self.error = "Failed to connect: \(error.localizedDescription)"
            print("❌ Connection failed: \(error)")
        }
    }
    
    private func configureSession() async {
        // Session is already configured when we get the ephemeral token
        // The backend sets up voice, tools, and instructions
        print("✅ Session configured via ephemeral token")
    }
    
    private func handleRealtimeMessage(_ message: [String: Any]) {
        guard let type = message["type"] as? String else { return }
        
        switch type {
        case "response.audio.delta":
            // Audio is handled automatically by WebRTC
            break
            
        case "response.audio_transcript.delta":
            if let delta = message["delta"] as? String {
                currentTranscript += delta
            }
            
        case "response.audio_transcript.done":
            if !currentTranscript.isEmpty {
                print("🤖 [VoiceAIManager] AI transcript done: \(currentTranscript.prefix(50))...")
                let chatMessage = Message(
                    conversationId: conversationId,
                    userId: Auth.auth().currentUser?.uid ?? "",
                    role: .assistant,
                    content: currentTranscript,
                    source: .voice,
                    voiceTranscript: currentTranscript
                )
                messages.append(chatMessage)
                print("🤖 [VoiceAIManager] Added AI message to local messages array (count: \(messages.count))")
                currentTranscript = ""
                
                // Persist AI response to Firestore
                print("🤖 [VoiceAIManager] Starting persistence of AI message...")
                Task {
                    await persistMessage(chatMessage)
                }
            }
            
        case "input_audio_buffer.speech_started":
            isListening = true
            
        case "input_audio_buffer.speech_stopped":
            isListening = false
            
        case "input_audio_buffer.committed":
            // User's speech was committed
            print("🎙️ [VoiceAIManager] User audio buffer committed")
            break
            
        case "conversation.item.input_audio_transcription.completed":
            // This event contains the transcript of user's speech
            if let transcript = message["transcript"] as? String {
                print("🎤 [VoiceAIManager] User transcript received: \(transcript.prefix(50))...")
                let chatMessage = Message(
                    conversationId: conversationId,
                    userId: Auth.auth().currentUser?.uid ?? "",
                    role: .user,
                    content: transcript,
                    source: .voice,
                    voiceTranscript: transcript
                )
                messages.append(chatMessage)
                print("🎤 [VoiceAIManager] Added user message to local messages array (count: \(messages.count))")
                
                // Persist user message to Firestore
                print("🎤 [VoiceAIManager] Starting persistence of user message...")
                Task {
                    await persistMessage(chatMessage)
                }
            }
            break
            
        case "conversation.item.created":
            if let item = message["item"] as? [String: Any],
               let role = item["role"] as? String {
                print("📝 [VoiceAIManager] conversation.item.created - role: \(role)")
                if role == "user" {
                    if let content = item["content"] as? [[String: Any]] {
                        print("📝 [VoiceAIManager] User item has \(content.count) content items")
                        for (index, contentItem) in content.enumerated() {
                            let contentType = contentItem["type"] as? String ?? "unknown"
                            print("📝 [VoiceAIManager] Content item \(index): type=\(contentType)")
                            print("📝 [VoiceAIManager] Content item keys: \(contentItem.keys.sorted())")
                            
                            if contentType == "input_audio",
                               let transcript = contentItem["transcript"] as? String {
                                print("🎤 [VoiceAIManager] User transcript: \(transcript.prefix(50))...")
                                let chatMessage = Message(
                                    conversationId: conversationId,
                                    userId: Auth.auth().currentUser?.uid ?? "",
                                    role: .user,
                                    content: transcript,
                                    source: .voice,
                                    voiceTranscript: transcript
                                )
                                messages.append(chatMessage)
                                print("🎤 [VoiceAIManager] Added user message to local messages array (count: \(messages.count))")
                                
                                // Persist user message to Firestore
                                print("🎤 [VoiceAIManager] Starting persistence of user message...")
                                Task {
                                    await persistMessage(chatMessage)
                                }
                            }
                        }
                    }
                }
            }
            
        case "response.function_call_arguments.done":
            if let name = message["name"] as? String,
               let callId = message["call_id"] as? String,
               let argumentsString = message["arguments"] as? String {
                lastFunctionCall = "Function called: \(name)"
                print("📦 Function call: \(name) with args: \(argumentsString)")
                
                // Execute function on backend and send result back to OpenAI
                Task {
                    await executeFunctionOnBackend(name: name, arguments: argumentsString, callId: callId)
                }
            }
            
        case "error":
            if let error = message["error"] as? [String: Any],
               let errorMessage = error["message"] as? String {
                self.error = errorMessage
            }
            
        default:
            break
        }
        
        // Update connection state
        isConnected = webRTCClient?.isConnected ?? false
    }
    
    
    // Remove old setupObservers method - it's no longer needed
    private func setupObservers_old() async {
        // This method is removed
    }
    // All function handling is now done on the backend
    
    func startListening() async throws {
        // WebRTC handles audio automatically
        // Just update state
        isListening = true
        error = nil
    }
    
    func stopListening() async {
        // WebRTC handles audio automatically
        isListening = false
    }
    
    func startHandlingVoice() async throws {
        // Ensure connection is ready
        if !isConnected {
            await connectToBackend()
        }
        
        guard isConnected else {
            self.error = "Not connected to server"
            throw VoiceAIError.notConnected
        }
        
        // WebRTC handles audio automatically
        error = nil
    }
    
    func stopHandlingVoice() async {
        // WebRTC handles audio automatically
        isListening = false
    }
    
    func sendMessage(_ text: String) async throws {
        // Ensure connection exists
        guard webRTCClient != nil else {
            throw VoiceAIError.notInitialized
        }

        // Send text message via data channel
        let realtimeMessage: [String: Any] = [
            "type": "conversation.item.create",
            "item": [
                "type": "message",
                "role": "user",
                "content": [[
                    "type": "input_text",
                    "text": text
                ]]
            ]
        ]

        let responseCreate: [String: Any] = ["type": "response.create"]

        try await sendRealtimeEvent(realtimeMessage)
        try await sendRealtimeEvent(responseCreate)

        // Add to messages
        let chatMessage = Message(
            conversationId: conversationId,
            userId: Auth.auth().currentUser?.uid ?? "",
            role: .user,
            content: text,
            source: .voice
        )
        messages.append(chatMessage)

        // Persist text message to Firestore
        Task {
            await persistMessage(chatMessage)
        }

        error = nil
    }

    // New method to send image with optional text question
    func sendImageQuestion(
        imageData: Data,
        text: String = "I just took this photo. Can you take a look?",
        shouldPersist: Bool = true
    ) async throws {
        // Convert image data to base64 data URL (per OpenAI realtime spec)
        let base64String = imageData.base64EncodedString()
        let dataURL = "data:image/jpeg;base64,\(base64String)"

        // Create conversation item with text and image
        var contentArray: [[String: Any]] = []

        // Add image payload using a data URL, which matches OpenAI's realtime spec
        contentArray.append([
            "type": "input_image",
            "image_url": dataURL
        ])

        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedText.isEmpty {
            contentArray.append([
                "type": "input_text",
                "text": trimmedText
            ])
        }

        let realtimeMessage: [String: Any] = [
            "type": "conversation.item.create",
            "item": [
                "type": "message",
                "role": "user",
                "content": contentArray
            ]
        ]

        let responseCreate: [String: Any] = ["type": "response.create"]

        try await sendRealtimeEvent(realtimeMessage)
        try await sendRealtimeEvent(responseCreate)

        // Add to messages (with text + image indicator)
        if shouldPersist {
            let summary = trimmedText
            let chatMessage = Message(
                conversationId: conversationId,
                userId: Auth.auth().currentUser?.uid ?? "",
                role: .user,
                content: summary.isEmpty ? "[📸 Image attached]" : summary,
                type: .image,
                metadata: [
                    "source": Message.MessageSource.camera.rawValue,
                    "hasImage": "true"
                ],
                source: .camera
            )
            messages.append(chatMessage)
            
            Task {
                await persistMessage(chatMessage)
            }
        }

        error = nil
    }

    // Alternative method using image URL
    func sendImageQuestionWithURL(
        imageURL: String,
        text: String = "I just took this photo. Can you take a look?",
        shouldPersist: Bool = true
    ) async throws {
        // Create conversation item with text and image URL
        var contentArray: [[String: Any]] = [
            [
                "type": "input_text",
                "text": text
            ]
        ]

        // Add image URL
        contentArray.append([
            "type": "input_image",
            "image_url": imageURL
        ])

        let realtimeMessage: [String: Any] = [
            "type": "conversation.item.create",
            "item": [
                "type": "message",
                "role": "user",
                "content": contentArray
            ]
        ]

        let responseCreate: [String: Any] = ["type": "response.create"]

        try await sendRealtimeEvent(realtimeMessage)
        try await sendRealtimeEvent(responseCreate)

        // Add to messages
        let chatMessage = Message(
            conversationId: conversationId,
            userId: Auth.auth().currentUser?.uid ?? "",
            role: .user,
            content: "\(text) [📸 Image: \(imageURL)]",
            type: .image,
            metadata: [
                "source": Message.MessageSource.camera.rawValue,
                "hasImage": "true",
                "imageURL": imageURL
            ],
            source: .camera
        )
        messages.append(chatMessage)

        // Persist message to Firestore
        if shouldPersist {
            Task {
                await persistMessage(chatMessage)
            }
        }

        error = nil
    }

    private func sendRealtimeEvent(_ payload: [String: Any]) async throws {
        guard let webRTCClient = webRTCClient else {
            throw VoiceAIError.notInitialized
        }

        let maxAttempts = 3

        _ = await waitForDataChannelReady(timeout: 0.5)

        for attempt in 0..<maxAttempts {
            if webRTCClient.sendMessage(payload) {
                return
            }

            print("⚠️ [VoiceAIManager] Data channel send failed (attempt \(attempt + 1))")

            await reconnectRealtimeChannelIfNeeded()

            if attempt < maxAttempts - 1 {
                try? await Task.sleep(nanoseconds: 200_000_000)
            }
        }

        throw VoiceAIError.dataChannelUnavailable
    }

    private func reconnectRealtimeChannelIfNeeded() async {
        guard let webRTCClient = webRTCClient else { return }

        if webRTCClient.isDataChannelOpen {
            return
        }

        // Give the existing connection a brief chance to recover before rebuilding it
        if await waitForDataChannelReady(timeout: 0.5) {
            return
        }

        print("♻️ [VoiceAIManager] Attempting to refresh realtime connection")

        webRTCClient.disconnect()
        await connectToBackend()

        let _ = await waitForDataChannelReady(timeout: 2.0)
    }

    private func waitForDataChannelReady(timeout: TimeInterval) async -> Bool {
        guard let webRTCClient = webRTCClient else { return false }

        if webRTCClient.isDataChannelOpen {
            return true
        }

        let interval: UInt64 = 100_000_000 // 0.1s
        let iterations = max(Int((timeout / 0.1).rounded(.up)), 1)

        for _ in 0..<iterations {
            if webRTCClient.isDataChannelOpen {
                return true
            }
            try? await Task.sleep(nanoseconds: interval)
        }

        return webRTCClient.isDataChannelOpen
    }

    func interrupt() async {
        // Send interrupt command via data channel
        webRTCClient?.sendMessage(["type": "response.cancel"])
    }
    
    func closeVoiceMode() async {
        // Stop any ongoing response
        webRTCClient?.sendMessage(["type": "response.cancel"])
        
        // If there's a partial transcript, save it as a message
        if !currentTranscript.isEmpty {
            print("📝 [VoiceAIManager] Saving partial AI transcript before closing: \(currentTranscript.prefix(50))...")
            let chatMessage = Message(
                conversationId: conversationId,
                userId: "assistant",
                role: .assistant,
                content: currentTranscript,
                source: .voice,
                voiceTranscript: currentTranscript
            )
            messages.append(chatMessage)
            
            // Persist the partial message
            Task {
                await persistMessage(chatMessage)
            }
            
            currentTranscript = ""
        }
        
        // WebRTC handles audio cleanup
        isListening = false
        
        // Keep connection alive for potential reuse
        print("📊 Voice mode closed, messages count: \(messages.count)")
    }
    
    func disconnect() async {
        // Save any partial transcript to messages array (but don't persist to Firebase)
        if !currentTranscript.isEmpty {
            let partialMessage = Message(
                conversationId: conversationId,
                userId: "assistant",
                role: .assistant,
                content: currentTranscript,
                source: .voice,
                voiceTranscript: currentTranscript
            )
            messages.append(partialMessage)
            print("✅ Added partial assistant transcript to messages: \(currentTranscript)")
        }
        
        // Complete teardown
        webRTCClient?.disconnect()
        
        isListening = false
        isConnected = false
        isInitialized = false
        
        // Preserve messages for merging into chat
        print("✅ VoiceAIManager disconnected, preserved \(messages.count) messages")
        
        // Clear everything else
        currentTranscript = ""
        error = nil
        ephemeralToken = nil
        sessionId = nil
        conversationId = ""
        conversationViewModel = nil
    }
    
    func reset() {
        messages.removeAll()
        currentTranscript = ""
        error = nil
        // Reconnect if needed
        Task {
            await connectToBackend()
        }
    }
    
    private func executeFunctionOnBackend(name: String, arguments: String, callId: String) async {
        do {
            // Parse arguments
            guard let argsData = arguments.data(using: .utf8),
                  let args = try? JSONSerialization.jsonObject(with: argsData) as? [String: Any] else {
                print("Failed to parse function arguments")
                return
            }
            
            // Get auth token
            guard let firebaseUser = Auth.auth().currentUser else { return }
            let token = try await firebaseUser.getIDToken()
            let safeToken = token.sanitizedForHTTPHeader
            
            // Call backend to execute function
            guard let url = URL(string: "\(AppConfig.apiBaseURL)/realtime/function") else { return }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(safeToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = [
                "name": name,
                "arguments": args
            ] as [String: Any]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("Function execution failed - no response")
                return
            }
            
            if httpResponse.statusCode != 200 {
                print("Function execution failed with status: \(httpResponse.statusCode)")
                if let errorText = String(data: data, encoding: .utf8) {
                    print("Error: \(errorText)")
                }
                return
            }
            
            // Parse result
            guard let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                print("Failed to parse function result")
                return
            }
            
            print("📋 Function result from backend: \(result)")
            
            // Send result back to OpenAI via data channel
            // The output should be a JSON string, not base64
            let outputString = String(data: try JSONSerialization.data(withJSONObject: result), encoding: .utf8) ?? "{}"
            
            let functionOutput: [String: Any] = [
                "type": "conversation.item.create",
                "item": [
                    "type": "function_call_output",
                    "call_id": callId,
                    "output": outputString
                ]
            ]
            
            webRTCClient?.sendMessage(functionOutput)
            
            // Trigger response
            webRTCClient?.sendMessage(["type": "response.create"])
            
            print("✅ Function \(name) executed and result sent back")
            
        } catch {
            print("❌ Function execution error: \(error)")
        }
    }
}

enum VoiceAIError: LocalizedError {
    case notInitialized
    case notAuthenticated
    case notConnected
    case invalidURL
    case dataChannelUnavailable

    var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Voice AI not initialized"
        case .notAuthenticated:
            return "User not authenticated"
        case .notConnected:
            return "Not connected to voice server"
        case .invalidURL:
            return "Invalid server URL"
        case .dataChannelUnavailable:
            return "Voice session isn't ready for new messages"
        }
    }
}

// Response struct for ephemeral token
struct RealtimeTokenResponse: Codable {
    let success: Bool
    let token: String
    let expires_at: Int?
    let session_id: String
    let model: String?
}
