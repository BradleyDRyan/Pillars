//
//  ConversationViewModel.swift
//  Squirrel2
//
//  Main ViewModel for managing conversations, messages, and streaming
//

import Foundation
import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import Combine

@MainActor
final class ConversationViewModel: ObservableObject {
    // Content block - either text or tool call, stored in order
    enum ContentBlock: Identifiable {
        case text(String)
        case toolCall(ToolCallState)
        
        var id: String {
            switch self {
            case .text(let text): return "text-\(text.hashValue)"
            case .toolCall(let tc): return tc.id
            }
        }
    }
    
    // Tool call state (used in contentBlocks and activeToolCall)
    struct ToolCallState: Identifiable, Hashable {
        let id: String
        let name: String
        var status: String  // "calling", "reading", "complete", "error"
        var title: String?
        var pageCount: Int?
    }
    
    // Message model (uses shared MessageRole enum)
    struct Message: Identifiable {
        let id = UUID()
        let role: MessageRole
        var contentBlocks: [ContentBlock] = []  // Ordered blocks: text and tool calls interleaved
        var isStreaming: Bool = false
        var responseId: String?
        var type: String = "text"
        var attachments: [String] = []
        
        // Computed property for plain text content (for compatibility)
        var content: String {
            contentBlocks.compactMap { block in
                if case .text(let text) = block { return text }
                return nil
            }.joined()
        }
        
        // Initialize with plain text
        init(role: MessageRole, content: String, isStreaming: Bool = false, responseId: String? = nil, type: String = "text", attachments: [String] = []) {
            self.role = role
            self.contentBlocks = content.isEmpty ? [] : [.text(content)]
            self.isStreaming = isStreaming
            self.responseId = responseId
            self.type = type
            self.attachments = attachments
        }
    }

    // Published properties for SwiftUI
    @Published var messages: [Message] = []
    @Published var isStreaming: Bool = false
    @Published var errorMessage: String?
    @Published var conversation: Conversation?

    // Private properties
    private var streamTask: Task<Void, Never>?
    private let db = Firestore.firestore()
    private var messagesListener: ListenerRegistration?

    // Initialize and fetch API key
    func setup(conversationId: String? = nil, existingConversation: Conversation? = nil, projectIds: [String] = []) async {
        print("🔧 [ConversationViewModel] setup() called - conversationId: \(conversationId ?? "nil"), projectIds: \(projectIds)")
        
        // Load or create conversation
        if let conversationId = conversationId {
            await loadConversation(id: conversationId, existingConversation: existingConversation)
        } else {
            print("🆕 [ConversationViewModel] Creating new conversation...")
            await createNewConversation(projectIds: projectIds)
        }
        
        print("🔧 [ConversationViewModel] setup() complete - conversation: \(conversation?.id ?? "nil")")
    }

    // Create a new conversation
    private func createNewConversation(projectIds: [String] = []) async {
        print("📝 [ConversationViewModel] createNewConversation() starting... projectIds: \(projectIds)")
        
        guard let user = Auth.auth().currentUser else {
            print("❌ [ConversationViewModel] Not authenticated - no current user")
            errorMessage = "Not authenticated"
            return
        }
        
        print("✅ [ConversationViewModel] User authenticated: \(user.uid)")

        do {
            let token = try await user.getIDToken()
            print("✅ [ConversationViewModel] Got auth token")

            guard let url = URL(string: "\(AppConfig.apiBaseURL)/conversations") else {
                print("❌ [ConversationViewModel] Invalid URL")
                return
            }
            
            print("🌐 [ConversationViewModel] Calling API: \(url)")

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            // Get current location metadata
            LocationManager.shared.getCurrentLocation()
            let locationMetadata = LocationManager.shared.getLocationMetadata()

            // Send projectIds to backend
            let body: [String: Any] = [
                "title": "New Conversation",
                "projectIds": projectIds,
                "metadata": locationMetadata
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [ConversationViewModel] Invalid HTTP response")
                errorMessage = "Invalid response"
                return
            }
            
            print("📡 [ConversationViewModel] Response status: \(httpResponse.statusCode)")
            
            guard httpResponse.statusCode == 201 else {
                let responseBody = String(data: data, encoding: .utf8) ?? "no body"
                print("❌ [ConversationViewModel] Failed to create - status: \(httpResponse.statusCode), body: \(responseBody)")
                errorMessage = "Failed to create conversation"
                return
            }

            // Log raw response for debugging
            let responseString = String(data: data, encoding: .utf8) ?? "unable to decode"
            print("📦 [ConversationViewModel] Raw response: \(responseString)")
            
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601WithFractionalSeconds
            conversation = try decoder.decode(Conversation.self, from: data)
            
            print("✅ [ConversationViewModel] Created conversation: \(conversation?.id ?? "nil")")

            // Start listening to messages
            if let conversationId = conversation?.id {
                startListeningToMessages(conversationId: conversationId)
            }

        } catch let decodingError as DecodingError {
            print("❌ [ConversationViewModel] Decoding error: \(decodingError)")
            switch decodingError {
            case .keyNotFound(let key, let context):
                print("❌ [ConversationViewModel] Key '\(key.stringValue)' not found: \(context.debugDescription)")
            case .typeMismatch(let type, let context):
                print("❌ [ConversationViewModel] Type mismatch for \(type): \(context.debugDescription)")
            case .valueNotFound(let type, let context):
                print("❌ [ConversationViewModel] Value not found for \(type): \(context.debugDescription)")
            case .dataCorrupted(let context):
                print("❌ [ConversationViewModel] Data corrupted: \(context.debugDescription)")
            @unknown default:
                print("❌ [ConversationViewModel] Unknown decoding error")
            }
            errorMessage = "Error decoding conversation: \(decodingError.localizedDescription)"
        } catch {
            print("❌ [ConversationViewModel] Error: \(error)")
            errorMessage = "Error creating conversation: \(error.localizedDescription)"
        }
    }

    // Load existing conversation
    func loadConversation(id: String, existingConversation: Conversation? = nil) async {
        // Use existing conversation if provided, otherwise create minimal one
        if let existing = existingConversation {
            conversation = existing
        } else {
            conversation = Conversation(
                id: id,
                userId: Auth.auth().currentUser?.uid ?? "",
                projectIds: [],
                title: "Chat",
                lastMessage: nil,
                createdAt: Date(),
                updatedAt: Date()
            )
        }

        print("📚 [ConversationViewModel] Loading conversation: \(id)")
        print("📚 [ConversationViewModel] Conversation title: \(conversation?.title ?? "none")")

        // Start listening to messages
        startListeningToMessages(conversationId: id)
    }

    // Listen to messages from Firestore
    func startListeningToMessages(conversationId: String) {
        print("🎧 [ConversationViewModel] Starting Firestore listener for conversation: \(conversationId)")
        messagesListener?.remove()

        messagesListener = db.collection("conversations")
            .document(conversationId)
            .collection("messages")
            .order(by: "createdAt")
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else {
                    print("❌ [ConversationViewModel] Self is nil in listener")
                    return
                }

                print("🔔 [ConversationViewModel] Firestore snapshot received for: \(conversationId)")

                if let error = error {
                    print("❌ [ConversationViewModel] Error loading messages: \(error.localizedDescription)")
                    self.errorMessage = "Error loading messages: \(error.localizedDescription)"
                    return
                }

                guard let documents = snapshot?.documents else {
                    print("⚠️ [ConversationViewModel] No documents in snapshot")
                    return
                }

                print("📬 [ConversationViewModel] Received \(documents.count) messages")

                // Don't update messages if we're currently streaming
                // This prevents index out of range errors
                if self.isStreaming {
                    print("⏸️ [ConversationViewModel] Skipping update - currently streaming")
                    return
                }

                // Convert Firestore messages to our Message type
                let newMessages: [Message] = documents.compactMap { doc in
                    let data = doc.data()
                    guard let content = data["content"] as? String,
                          let roleString = data["role"] as? String else {
                        print("⚠️ [ConversationViewModel] Skipping message - missing content or role: \(doc.documentID)")
                        return nil
                    }

                    let role: MessageRole = roleString == "assistant" ? .assistant : .user
                    let messageType = data["type"] as? String ?? "text"
                    let attachments = data["attachments"] as? [String] ?? []

                    var message = Message(
                        role: role,
                        content: content,
                        isStreaming: false,
                        responseId: data["responseId"] as? String,
                        type: messageType,
                        attachments: attachments
                    )
                    
                    // Load tool calls if present (for assistant messages)
                    if role == .assistant, let toolCallsData = data["toolCalls"] as? [[String: Any]] {
                        let loadedToolCalls = toolCallsData.compactMap { tcData -> ToolCallState? in
                            guard let id = tcData["id"] as? String,
                                  let name = tcData["name"] as? String else { return nil }
                            return ToolCallState(
                                id: id,
                                name: name,
                                status: tcData["status"] as? String ?? "complete",
                                title: tcData["title"] as? String,
                                pageCount: tcData["pageCount"] as? Int
                            )
                        }
                        
                        // Rebuild contentBlocks: tool calls first, then text
                        if !loadedToolCalls.isEmpty {
                            message.contentBlocks = loadedToolCalls.map { .toolCall($0) }
                            if !content.isEmpty {
                                message.contentBlocks.append(.text(content))
                            }
                        }
                    }

                    return message
                }

                // Smart merge: preserve existing messages that match to avoid flicker
                // This prevents the UI from re-rendering messages that are already displayed
                var mergedMessages: [Message] = []
                for (index, newMessage) in newMessages.enumerated() {
                    if index < self.messages.count {
                        let existingMessage = self.messages[index]
                        // Keep existing message if content and role match (preserves local ID)
                        if existingMessage.content == newMessage.content && 
                           existingMessage.role == newMessage.role {
                            mergedMessages.append(existingMessage)
                        } else {
                            mergedMessages.append(newMessage)
                        }
                    } else {
                        mergedMessages.append(newMessage)
                    }
                }
                
                self.messages = mergedMessages
                print("✅ [ConversationViewModel] Updated messages array with \(self.messages.count) messages")
            }
    }

    // Send a message and stream the response
    func send(_ text: String) {
        print("📤 [ConversationViewModel] send() called with: \(text)")

        // Ensure we have a conversation
        guard let conversation = conversation else {
            print("❌ [ConversationViewModel] No active conversation")
            errorMessage = "No active conversation"
            return
        }

        print("✅ [ConversationViewModel] Using conversation: \(conversation.id)")

        // Cancel any existing stream
        streamTask?.cancel()

        // Add user message locally for immediate UI update
        // (Firestore listener is disabled during streaming to prevent conflicts)
        let userMessage = Message(role: .user, content: text)
        messages.append(userMessage)

        // Save user message to Firebase via backend
        Task {
            await saveMessageToFirebase(content: text, role: .user)
        }

        // Start streaming in background
        print("🚀 [ConversationViewModel] Starting stream task...")
        streamTask = Task {
            await performStreaming(userInput: text)
        }
    }

    // Save message to Firebase via backend API
    private func saveMessageToFirebase(content: String, role: MessageRole, responseId: String? = nil, toolCalls: [ToolCallState]? = nil) async {
        guard let conversationId = conversation?.id,
              let user = Auth.auth().currentUser else { return }

        do {
            let token = try await user.getIDToken()

            guard let url = URL(string: "\(AppConfig.apiBaseURL)/conversations/\(conversationId)/messages") else { return }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            var body: [String: Any] = [
                "content": content,
                "type": "text",
                "role": role.rawValue
            ]

            if let responseId = responseId {
                body["metadata"] = ["responseId": responseId]
            }
            
            // Save tool calls if present
            if let toolCalls = toolCalls, !toolCalls.isEmpty {
                body["toolCalls"] = toolCalls.map { tc in
                    [
                        "id": tc.id,
                        "name": tc.name,
                        "status": tc.status,
                        "title": tc.title ?? "",
                        "pageCount": tc.pageCount ?? 0
                    ] as [String: Any]
                }
            }

            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (_, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 201 {
                print("✅ Message saved to Firebase")
            }
        } catch {
            print("Error saving message: \(error)")
        }
    }

    // SSE Event payload structures for Anthropic-style events
    private struct SSEventPayload: Decodable {
        let type: String
        let data: SSEventData?
        let metadata: SSEventMetadata?
        
        // Legacy support for simple events
        let content: String?
        let error: String?
    }
    
    private struct SSEventData: Decodable {
        // For text events, data is just a string
        // For tool events, it's structured
        let id: String?
        let name: String?
        let input: [String: AnyCodable]?
        let content: String?
        let isError: Bool?
        let message: String?
        let title: String?
        let status: String?
        let pageCount: Int?
        let attachmentId: String?
        
        init(from decoder: Decoder) throws {
            // Try to decode as string first (for text events)
            if let container = try? decoder.singleValueContainer(),
               let stringValue = try? container.decode(String.self) {
                self.id = nil
                self.name = nil
                self.input = nil
                self.content = stringValue
                self.isError = nil
                self.message = nil
                self.title = nil
                self.status = nil
                self.pageCount = nil
                self.attachmentId = nil
                return
            }
            
            // Otherwise decode as object
            let container = try decoder.container(keyedBy: CodingKeys.self)
            self.id = try container.decodeIfPresent(String.self, forKey: .id)
            self.name = try container.decodeIfPresent(String.self, forKey: .name)
            self.input = try container.decodeIfPresent([String: AnyCodable].self, forKey: .input)
            self.content = try container.decodeIfPresent(String.self, forKey: .content)
            self.isError = try container.decodeIfPresent(Bool.self, forKey: .isError)
            self.message = try container.decodeIfPresent(String.self, forKey: .message)
            self.title = try container.decodeIfPresent(String.self, forKey: .title)
            self.status = try container.decodeIfPresent(String.self, forKey: .status)
            self.pageCount = try container.decodeIfPresent(Int.self, forKey: .pageCount)
            self.attachmentId = try container.decodeIfPresent(String.self, forKey: .attachmentId)
        }
        
        private enum CodingKeys: String, CodingKey {
            case id, name, input, content, isError, message, title, status, pageCount, attachmentId
        }
    }
    
    private struct SSEventMetadata: Decodable {
        let status: String?
        let source: String?
        let timestamp: String?
    }
    
    // Helper for decoding arbitrary JSON
    struct AnyCodable: Decodable {
        let value: Any
        
        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let string = try? container.decode(String.self) {
                value = string
            } else if let int = try? container.decode(Int.self) {
                value = int
            } else if let double = try? container.decode(Double.self) {
                value = double
            } else if let bool = try? container.decode(Bool.self) {
                value = bool
            } else {
                value = ""
            }
        }
    }
    
    @Published var activeToolCall: ToolCallState?

    // Main streaming logic
    private func performStreaming(userInput: String) async {
        print("🤖 [ConversationViewModel] Starting streaming for: \(userInput)")

        guard conversation?.id != nil else {
            print("❌ [ConversationViewModel] Missing conversation ID")
            errorMessage = "Conversation not available"
            return
        }

        guard let user = Auth.auth().currentUser else {
            print("❌ [ConversationViewModel] No authenticated user")
            errorMessage = "Not authenticated"
            return
        }

        // Update state
        isStreaming = true
        errorMessage = nil

        // Add placeholder for streaming message
        let streamingMessage = Message(
            role: .assistant,
            content: "",
            isStreaming: true
        )
        let streamingId = streamingMessage.id
        messages.append(streamingMessage)

        do {
            let token = try await user.getIDToken()

            guard let url = URL(string: "\(AppConfig.apiBaseURL)/ai/chat/stream") else {
                throw NSError(domain: "ConversationViewModel", code: -1, userInfo: [
                    NSLocalizedDescriptionKey: "Invalid streaming URL"
                ])
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 120

            // Build message history excluding the streaming placeholder
            let historyMessages = messages
                .filter { !$0.isStreaming }
                .map { ["role": $0.role.rawValue, "content": $0.content] }

            // Include conversation and project context for tool execution
            var body: [String: Any] = [
                "messages": historyMessages
            ]
            
            if let conversationId = conversation?.id {
                body["conversationId"] = conversationId
            }
            
            // Include project ID for file reading
            if let projectId = conversation?.projectIds.first {
                body["projectId"] = projectId
            }
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            print("🌊 [ConversationViewModel] Opening SSE stream via backend...")
            let (bytes, response) = try await URLSession.shared.bytes(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw NSError(domain: "ConversationViewModel", code: -2, userInfo: [
                    NSLocalizedDescriptionKey: "Invalid HTTP response"
                ])
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                var errorData = Data()
                for try await byte in bytes {
                    errorData.append(byte)
                }
                let message = String(data: errorData, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
                throw NSError(domain: "ConversationViewModel", code: httpResponse.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: message
                ])
            }

            print("✅ [ConversationViewModel] Stream established, awaiting events...")

            var fullText = ""
            streamLoop: for try await line in bytes.lines {
                if Task.isCancelled {
                    print("⏹️ [ConversationViewModel] Stream cancelled")
                    break
                }

                guard line.hasPrefix("data:") else { continue }

                var payloadString = line.dropFirst(5) // remove "data:"
                if payloadString.first == " " {
                    payloadString.removeFirst()
                }

                guard !payloadString.isEmpty else { continue }
                guard let payloadData = payloadString.data(using: .utf8) else { continue }

                let event = try JSONDecoder().decode(SSEventPayload.self, from: payloadData)

                switch event.type {
                case "connected":
                    print("🔗 [ConversationViewModel] Stream connected")

                case "text":
                    // New Anthropic-style text delta - append to current text block
                    var chunk: String? = nil
                    if let dataContent = event.data?.content {
                        chunk = dataContent
                    } else if let dataString = event.data, let content = dataString.content {
                        chunk = content
                    }
                    
                    if let chunk = chunk {
                        fullText += chunk
                        if let index = messages.firstIndex(where: { $0.id == streamingId }) {
                            // Check if LAST block is text - if so, append; otherwise create new text block
                            if case .text(let existing) = messages[index].contentBlocks.last {
                                let lastIndex = messages[index].contentBlocks.count - 1
                                messages[index].contentBlocks[lastIndex] = .text(existing + chunk)
                            } else {
                                messages[index].contentBlocks.append(.text(chunk))
                            }
                        }
                    }
                    
                case "content":
                    // Legacy format support
                    guard let chunk = event.content else { break }
                    fullText += chunk

                    if let index = messages.firstIndex(where: { $0.id == streamingId }) {
                        // Check if LAST block is text - if so, append; otherwise create new text block
                        if case .text(let existing) = messages[index].contentBlocks.last {
                            let lastIndex = messages[index].contentBlocks.count - 1
                            messages[index].contentBlocks[lastIndex] = .text(existing + chunk)
                        } else {
                            messages[index].contentBlocks.append(.text(chunk))
                        }
                    }
                    
                case "tool_call":
                    // Claude is calling a tool - insert as a block in order
                    if let toolName = event.data?.name, let toolId = event.data?.id {
                        print("🔧 [ConversationViewModel] Tool call: \(toolName)")
                        let toolCallState = ToolCallState(
                            id: toolId,
                            name: toolName,
                            status: "calling",
                            title: toolName == "read_file" ? "Reading document..." : nil
                        )
                        activeToolCall = toolCallState
                        
                        // Add tool call as a content block (in order)
                        if let index = messages.firstIndex(where: { $0.id == streamingId }) {
                            messages[index].contentBlocks.append(.toolCall(toolCallState))
                        }
                    }
                    
                case "file_reading":
                    // File reading status update
                    if let status = event.data?.status {
                        print("📄 [ConversationViewModel] File reading: \(status)")
                        if var toolCall = activeToolCall {
                            toolCall.status = status
                            toolCall.title = event.data?.title
                            toolCall.pageCount = event.data?.pageCount
                            activeToolCall = toolCall
                            
                            // Update tool call block in message
                            if let index = messages.firstIndex(where: { $0.id == streamingId }) {
                                for (blockIndex, block) in messages[index].contentBlocks.enumerated() {
                                    if case .toolCall(let tc) = block, tc.id == toolCall.id {
                                        messages[index].contentBlocks[blockIndex] = .toolCall(toolCall)
                                        break
                                    }
                                }
                            }
                        }
                    }
                    
                case "tool_result":
                    // Tool execution completed
                    print("✅ [ConversationViewModel] Tool result received")
                    let isError = event.data?.isError ?? false
                    if isError {
                        print("⚠️ [ConversationViewModel] Tool returned error")
                    }
                    
                    // Update tool call status in content blocks
                    if var toolCall = activeToolCall,
                       let index = messages.firstIndex(where: { $0.id == streamingId }) {
                        toolCall.status = isError ? "error" : "complete"
                        for (blockIndex, block) in messages[index].contentBlocks.enumerated() {
                            if case .toolCall(let tc) = block, tc.id == toolCall.id {
                                messages[index].contentBlocks[blockIndex] = .toolCall(toolCall)
                                break
                            }
                        }
                    }
                    
                    // Clear active tool call UI state
                    activeToolCall = nil
                    
                case "final":
                    // Complete response - rebuild content blocks with final text
                    if let finalText = event.data?.content {
                        fullText = finalText
                    }
                    
                    if let index = messages.firstIndex(where: { $0.id == streamingId }) {
                        messages[index].isStreaming = false
                    }
                    
                    print("🏁 [ConversationViewModel] Final message received")
                    
                case "end_of_stream":
                    // Stream complete - extract tool calls BEFORE marking as done
                    let toolCallsToSave: [ToolCallState] = messages.first(where: { $0.id == streamingId })?.contentBlocks.compactMap { block in
                        if case .toolCall(let tc) = block { return tc }
                        return nil
                    } ?? []
                    
                    // Save synchronously to avoid race with Firestore listener
                    await saveMessageToFirebase(
                        content: fullText,
                        role: .assistant,
                        toolCalls: toolCallsToSave
                    )
                    
                    // Now safe to mark as complete
                    if let index = messages.firstIndex(where: { $0.id == streamingId }) {
                        messages[index].isStreaming = false
                    }
                    activeToolCall = nil
                    break streamLoop

                case "done":
                    // Legacy done event support - extract tool calls first
                    let toolCallsToSaveDone: [ToolCallState] = messages.first(where: { $0.id == streamingId })?.contentBlocks.compactMap { block in
                        if case .toolCall(let tc) = block { return tc }
                        return nil
                    } ?? []
                    
                    // Save synchronously
                    await saveMessageToFirebase(
                        content: fullText,
                        role: .assistant,
                        toolCalls: toolCallsToSaveDone
                    )
                    
                    if let index = messages.firstIndex(where: { $0.id == streamingId }) {
                        messages[index].isStreaming = false
                    }
                    break streamLoop

                case "error":
                    let message = event.data?.message ?? event.error ?? "Unknown streaming error"
                    errorMessage = message
                    print("❌ [ConversationViewModel] Stream error: \(message)")
                    activeToolCall = nil

                    if let index = messages.firstIndex(where: { $0.id == streamingId }) {
                        messages.remove(at: index)
                    }
                    break streamLoop

                default:
                    print("ℹ️ [ConversationViewModel] Unknown event type: \(event.type)")
                    break
                }
            }
            if let index = messages.firstIndex(where: { $0.id == streamingId && $0.isStreaming }) {
                if fullText.isEmpty {
                    messages.remove(at: index)
                    print("⚠️ [ConversationViewModel] Stream ended without content; removed placeholder message")
                } else {
                    messages[index].isStreaming = false
                    print("ℹ️ [ConversationViewModel] Stream ended without done event; scheduling save manually")
                    
                    let toolCallsToSaveFallback: [ToolCallState] = messages[index].contentBlocks.compactMap { block in
                        if case .toolCall(let tc) = block { return tc }
                        return nil
                    }
                    
                    Task {
                        await saveMessageToFirebase(
                            content: fullText,
                            role: .assistant,
                            toolCalls: toolCallsToSaveFallback
                        )
                    }
                }
            }
        } catch {
            print("❌ [ConversationViewModel] Streaming error: \(error)")
            errorMessage = error.localizedDescription

            if let index = messages.firstIndex(where: { $0.id == streamingId && $0.isStreaming }) {
                messages.remove(at: index)
            }
        }

        isStreaming = false
        // Note: No need to restart listener - it's already active and will 
        // process updates now that isStreaming is false. Smart merge prevents flicker.
    }

    // Stop current streaming
    func stopStreaming() {
        streamTask?.cancel()

        // Mark any streaming message as complete
        if let index = messages.lastIndex(where: { $0.isStreaming }) {
            messages[index].isStreaming = false
        }

        isStreaming = false
    }

    // Clean up listeners
    func cleanup() {
        messagesListener?.remove()
        messagesListener = nil
        streamTask?.cancel()
        streamTask = nil
    }
}
