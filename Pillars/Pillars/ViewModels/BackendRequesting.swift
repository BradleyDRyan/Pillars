//
//  BackendRequesting.swift
//  Pillars
//
//  Shared error helpers for Firestore-backed view models.
//

import Foundation

enum BackendError: Error, Equatable {
    case notFound
    case notAuthenticated
}

@MainActor
protocol BackendRequesting {}

extension BackendRequesting {
    func friendlyErrorMessage(_ error: Error) -> String {
        if let backendError = error as? BackendError {
            switch backendError {
            case .notFound:
                return "Requested record not found."
            case .notAuthenticated:
                return "Not authenticated. Please sign in again."
            }
        }

        if let urlError = error as? URLError {
            switch urlError.code {
            case .cannotConnectToHost, .cannotFindHost, .timedOut, .networkConnectionLost:
                return "Network unavailable."
            case .notConnectedToInternet:
                return "No internet connection."
            default:
                break
            }
        }

        return error.localizedDescription
    }
}
