//
//  BackendRequesting.swift
//  Pillars
//
//  Shared backend request helpers for view models.
//

import Foundation
import FirebaseAuth

enum BackendError: Error, Equatable {
    case notFound
    case notAuthenticated
    case invalidURL
    case invalidResponse
    case serverError(Int)
    case decodingFailure(String)
}

@MainActor
protocol BackendRequesting {}

extension BackendRequesting {
    func encodedPathComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }

    func performAPIRequest(
        path: String,
        method: String = "GET",
        body: [String: Any]? = nil,
        allowStatus: Set<Int> = []
    ) async throws -> (Data, Int, URL) {
        guard let user = Auth.auth().currentUser else { throw BackendError.notAuthenticated }
        let token = try await user.getIDToken()

        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        guard let url = URL(string: "\(AppConfig.apiBaseURL)\(normalizedPath)") else {
            throw BackendError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw BackendError.invalidResponse
        }

        if (200...299).contains(http.statusCode) || allowStatus.contains(http.statusCode) {
            return (data, http.statusCode, url)
        }
        if http.statusCode == 404 {
            throw BackendError.notFound
        }

        throw BackendError.serverError(http.statusCode)
    }

    func decodePayload<T: Decodable>(
        _ type: T.Type,
        from data: Data,
        context: String
    ) throws -> T {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .secondsSince1970
            return try decoder.decode(type, from: data)
        } catch {
            throw BackendError.decodingFailure("Invalid \(context) payload from backend.")
        }
    }

    func friendlyErrorMessage(_ error: Error) -> String {
        if let backendError = error as? BackendError {
            switch backendError {
            case .notFound:
                return "Requested record not found."
            case .notAuthenticated:
                return "Not authenticated. Please sign in again."
            case .invalidURL:
                return "Invalid backend URL."
            case .invalidResponse:
                return "Backend returned an invalid response."
            case .serverError(let code):
                return "Backend request failed (HTTP \(code))."
            case .decodingFailure(let message):
                return message
            }
        }

        if let urlError = error as? URLError {
            switch urlError.code {
            case .cannotConnectToHost, .cannotFindHost, .timedOut, .networkConnectionLost:
                return "Backend unavailable at \(AppConfig.apiBaseURL)."
            case .notConnectedToInternet:
                return "No internet connection."
            default:
                break
            }
        }

        return error.localizedDescription
    }
}
