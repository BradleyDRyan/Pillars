//
//  BlockIcon.swift
//  Pillars
//
//  Canonical block icon token resolver.
//

import SwiftUI

enum BlockIcon {
    static let tokenPrefix = "."
    static let fallbackToken = ".document"
    static let todoBlockToken = ".todo"

    static func resolvedSystemSymbol(from rawIcon: String?) -> String {
        guard let rawIcon else {
            return fallbackSymbol
        }

        let trimmed = rawIcon.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return fallbackSymbol
        }

        if trimmed.hasPrefix(tokenPrefix) {
            let token = String(trimmed.dropFirst())
            return tokenMap[token, default: fallbackSymbol]
        }

        return trimmed
    }

    static let fallbackSymbol = "doc.text"
    static let tokenMap: [String: String] = [
        "pencil": "pencil",
        "document": "doc.text",
        "sleep": "bed.double",
        "feeling": "heart.fill",
        "workout": "figure.run",
        "reflection": "sparkles",
        "habits": "arrow.triangle.2.circlepath",
        "todo": "square.and.pencil"
    ]

    static let fallback = fallbackToken
}
