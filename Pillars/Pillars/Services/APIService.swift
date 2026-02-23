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
    
    
    // MARK: - Pillars
    
    func fetchPillars() async throws -> [Pillar] {
        _ = try await getFirebaseToken()
        guard let url = URL(string: "\(baseURL)/pillars") else {
            throw APIError.invalidURL("\(baseURL)/pillars")
        }
        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [Pillar].self)
    }

    func fetchPillarTemplates(includeInactive: Bool = false) async throws -> [PillarTemplate] {
        _ = try await getFirebaseToken()

        var components = URLComponents(string: "\(baseURL)/pillar-templates")
        if includeInactive {
            components?.queryItems = [URLQueryItem(name: "includeInactive", value: "true")]
        }
        guard let url = components?.url else {
            throw APIError.invalidURL("\(baseURL)/pillar-templates")
        }

        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: [PillarTemplate].self)
    }

    func createPillar(
        name: String,
        description: String = "",
        colorToken: String? = nil,
        iconToken: String?,
        pillarType: String?,
        isDefault: Bool = false,
        metadata: [String: String]? = nil,
        rubricItems: [[String: Any]]? = nil
    ) async throws -> Pillar {
        _ = try await getFirebaseToken()
        guard let url = URL(string: "\(baseURL)/pillars") else {
            throw APIError.invalidURL("\(baseURL)/pillars")
        }

        var payload: [String: Any] = [
            "name": name,
            "description": description,
            "isDefault": isDefault
        ]

        if let iconToken,
           !iconToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            payload["icon"] = iconToken
        }
        if let colorToken, !colorToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            payload["colorToken"] = colorToken
        }
        if let pillarType, !pillarType.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            payload["pillarType"] = pillarType
        }
        if let metadata {
            payload["metadata"] = metadata
        }
        if let rubricItems {
            payload["rubricItems"] = rubricItems
        }

        let body = try JSONSerialization.data(withJSONObject: payload, options: [])
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: Pillar.self)
    }

    func fetchDefaultRubricTemplates() async throws -> [PillarType: [PillarRubricItem]] {
        _ = try await getFirebaseToken()
        guard let url = URL(string: "\(baseURL)/schemas/pillars") else {
            throw APIError.invalidURL("\(baseURL)/schemas/pillars")
        }

        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        let payload = try await handleResponse(data, response, nil, type: PillarSchemasEnvelope.self)

        let templates = payload.pillarSchema.defaultRubricTemplates ?? [:]
        var mapped: [PillarType: [PillarRubricItem]] = [:]

        for (rawType, rawItems) in templates {
            guard let pillarType = PillarType.resolve(rawType) else { continue }

            let normalized = rawItems.map { item in
                PillarRubricItem(
                    id: item.id,
                    activityType: item.activityType,
                    tier: item.tier,
                    label: item.label,
                    points: item.points,
                    examples: item.examples,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                )
            }

            if !normalized.isEmpty {
                mapped[pillarType] = normalized
            }
        }

        return mapped
    }

    func fetchPillarVisuals() async throws -> PillarVisualsResponse {
        _ = try await getFirebaseToken()
        guard let url = URL(string: "\(baseURL)/schemas/pillar-visuals") else {
            throw APIError.invalidURL("\(baseURL)/schemas/pillar-visuals")
        }

        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: PillarVisualsResponse.self)
    }

    // MARK: - Point Events

    func fetchPointEvents(pillarId: String, fromDate: String? = nil, toDate: String? = nil) async throws -> [PointEvent] {
        _ = try await getFirebaseToken()

        var components = URLComponents(string: "\(baseURL)/point-events")
        var items: [URLQueryItem] = [
            URLQueryItem(name: "pillarId", value: pillarId)
        ]
        if let fromDate {
            items.append(URLQueryItem(name: "fromDate", value: fromDate))
        }
        if let toDate {
            items.append(URLQueryItem(name: "toDate", value: toDate))
        }
        components?.queryItems = items

        guard let url = components?.url else {
            throw APIError.invalidURL("\(baseURL)/point-events")
        }

        let request = createRequest(url: url)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: PointEventsResponse.self).items
    }

    // MARK: - Todos

    func createTodo(
        content: String,
        dueDate: String?,
        assignment: TodoAssignmentSelection
    ) async throws -> TodoMutationResponse {
        _ = try await getFirebaseToken()
        guard let url = URL(string: "\(baseURL)/todos") else {
            throw APIError.invalidURL("\(baseURL)/todos")
        }

        var payload: [String: Any] = [
            "content": content,
            "assignment": [
                "mode": assignment.mode.rawValue,
                "pillarIds": assignment.mode == .manual ? assignment.pillarIds : []
            ]
        ]
        if let dueDate {
            payload["dueDate"] = dueDate
        }

        let body = try JSONSerialization.data(withJSONObject: payload, options: [])
        let request = createRequest(url: url, method: "POST", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: TodoMutationResponse.self)
    }

    func updateTodoAssignment(
        todoId: String,
        assignment: TodoAssignmentSelection
    ) async throws -> TodoMutationResponse {
        _ = try await getFirebaseToken()
        guard let url = URL(string: "\(baseURL)/todos/\(todoId)") else {
            throw APIError.invalidURL("\(baseURL)/todos/\(todoId)")
        }

        let payload: [String: Any] = [
            "assignment": [
                "mode": assignment.mode.rawValue,
                "pillarIds": assignment.mode == .manual ? assignment.pillarIds : []
            ]
        ]
        let body = try JSONSerialization.data(withJSONObject: payload, options: [])
        let request = createRequest(url: url, method: "PATCH", body: body)
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: TodoMutationResponse.self)
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
    
    // MARK: - Onboarding Content
    
    /// Fetch all onboarding content (pillars, themes, principles)
    /// This endpoint doesn't require authentication
    func fetchOnboardingContent() async throws -> OnboardingContent {
        guard let url = URL(string: "\(baseURL)/onboarding-content/full") else {
            throw APIError.invalidURL("\(baseURL)/onboarding-content/full")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Note: Not adding auth token since this is public content
        
        let (data, response) = try await session.data(for: request)
        return try await handleResponse(data, response, nil, type: OnboardingContent.self)
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

struct PointEventsResponse: Codable {
    let items: [PointEvent]
    let count: Int
}

struct TodoMutationResponse: Decodable {
    let todo: Todo
    let classificationSummary: TodoClassificationSummary?
}

private struct PillarSchemasEnvelope: Codable {
    let pillarSchema: PillarSchemaPayload
}

private struct PillarSchemaPayload: Codable {
    let defaultRubricTemplates: [String: [PillarSchemaRubricItem]]?
}

private struct PillarSchemaRubricItem: Codable {
    let id: String
    let activityType: String
    let tier: String
    let label: String
    let points: Int
    let examples: String?
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?
}
