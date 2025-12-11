import Foundation
import Combine
import UIKit
import FirebaseAuth

class APIService: ObservableObject {
    static let shared = APIService()
    
    private let baseURL: String
    private let session = URLSession.shared
    private var authToken: String?
    
    init() {
        self.baseURL = AppConfig.apiBaseURL
    }
    
    func setAuthToken(_ token: String) {
        self.authToken = token
    }
    
    private func getFirebaseToken() async throws -> String? {
        guard let user = Auth.auth().currentUser else {
            return authToken
        }
        
        do {
            let token = try await user.getIDToken()
            self.authToken = token
            return token
        } catch {
            return authToken
        }
    }
    
    private func createRequest(url: URL, method: String = "GET", body: Data? = nil) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        request.httpBody = body
        return request
    }
    
    private func handleResponse<T: Decodable>(_ data: Data, _ response: URLResponse?, _ error: Error?, type: T.Type) async throws -> T {
        if let error = error {
            throw APIError.networkError(error)
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601WithFractionalSeconds
        
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
    
    // MARK: - Conversations
    
    func fetchConversations(pillarId: String? = nil) async throws -> [Conversation] {
        var urlString = "\(baseURL)/conversations"
        if let pillarId = pillarId {
            urlString += "?pillarId=\(pillarId)"
        }
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL(urlString)
        }
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Conversation].self)
    }
    
    func createConversation(_ conversation: Conversation) async throws -> Conversation {
        guard let url = URL(string: "\(baseURL)/conversations") else {
            throw APIError.invalidURL("\(baseURL)/conversations")
        }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        let body = try encoder.encode(conversation)
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Conversation.self)
    }
    
    // MARK: - Messages
    
    func fetchMessages(conversationId: String) async throws -> [Message] {
        guard let url = URL(string: "\(baseURL)/conversations/\(conversationId)/messages") else {
            throw APIError.invalidURL("\(baseURL)/conversations/\(conversationId)/messages")
        }
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Message].self)
    }
    
    func sendMessage(_ message: Message) async throws -> Message {
        guard let url = URL(string: "\(baseURL)/messages") else {
            throw APIError.invalidURL("\(baseURL)/messages")
        }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        let body = try encoder.encode(message)
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Message.self)
    }
    
    // MARK: - Pillars
    
    func fetchPillars() async throws -> [Pillar] {
        guard let url = URL(string: "\(baseURL)/pillars") else {
            throw APIError.invalidURL("\(baseURL)/pillars")
        }
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Pillar].self)
    }
    
    // MARK: - Principles
    
    func fetchPrinciples(pillarId: String? = nil) async throws -> [Principle] {
        var urlString = "\(baseURL)/principles"
        if let pillarId = pillarId {
            urlString += "?pillarId=\(pillarId)"
        }
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL(urlString)
        }
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Principle].self)
    }
    
    // MARK: - Insights
    
    func fetchInsights(pillarId: String? = nil) async throws -> [Insight] {
        var urlString = "\(baseURL)/insights"
        if let pillarId = pillarId {
            urlString += "?pillarId=\(pillarId)"
        }
        guard let url = URL(string: urlString) else {
            throw APIError.invalidURL(urlString)
        }
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Insight].self)
    }
}

enum APIError: LocalizedError {
    case networkError(Error)
    case invalidResponse
    case httpError(Int)
    case decodingError(Error)
    case invalidURL(String)
    
    var errorDescription: String? {
        switch self {
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        }
    }
}
