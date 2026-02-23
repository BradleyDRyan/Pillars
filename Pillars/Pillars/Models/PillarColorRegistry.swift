import SwiftUI

struct PillarColorDefinition: Hashable {
    let token: String
    let label: String
    let hex: String
}

enum PillarColorRegistry {
    static let fallbackToken = "slate"

    static let definitions: [PillarColorDefinition] = [
        PillarColorDefinition(token: "coral", label: "Coral", hex: "#FF6B6B"),
        PillarColorDefinition(token: "rose", label: "Rose", hex: "#E91E63"),
        PillarColorDefinition(token: "violet", label: "Violet", hex: "#9C27B0"),
        PillarColorDefinition(token: "indigo", label: "Indigo", hex: "#5C7CFA"),
        PillarColorDefinition(token: "blue", label: "Blue", hex: "#2196F3"),
        PillarColorDefinition(token: "sky", label: "Sky", hex: "#4DABF7"),
        PillarColorDefinition(token: "mint", label: "Mint", hex: "#20C997"),
        PillarColorDefinition(token: "green", label: "Green", hex: "#4CAF50"),
        PillarColorDefinition(token: "lime", label: "Lime", hex: "#AEEA00"),
        PillarColorDefinition(token: "amber", label: "Amber", hex: "#FFB300"),
        PillarColorDefinition(token: "orange", label: "Orange", hex: "#FF9800"),
        PillarColorDefinition(token: "slate", label: "Slate", hex: "#607D8B")
    ]

    static func normalizeToken(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let trimmed = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return trimmed.isEmpty ? nil : trimmed
    }

    static func hasToken(_ token: String?) -> Bool {
        guard let normalized = normalizeToken(token) else { return false }
        return hexByToken[normalized] != nil
    }

    static func resolvedToken(_ token: String?) -> String {
        let normalized = normalizeToken(token)
        if let normalized, hexByToken[normalized] != nil {
            return normalized
        }
        return fallbackToken
    }

    static func color(for token: String?) -> Color {
        Color(hex: hex(for: token))
    }

    static func hex(for token: String?) -> String {
        let resolved = resolvedToken(token)
        return hexByToken[resolved] ?? hexByToken[fallbackToken] ?? "#607D8B"
    }

    static func token(forHex rawHex: String?) -> String? {
        guard let rawHex else { return nil }
        let normalized = normalizeHex(rawHex)
        guard let normalized else {
            return fallbackToken
        }
        return tokenByHex[normalized] ?? fallbackToken
    }

    private static let hexByToken: [String: String] = {
        var map: [String: String] = [:]
        for definition in definitions {
            map[definition.token] = definition.hex
        }
        return map
    }()

    private static let tokenByHex: [String: String] = {
        var map: [String: String] = [:]
        for definition in definitions {
            if let normalizedHex = normalizeHex(definition.hex) {
                map[normalizedHex] = definition.token
            }
        }
        return map
    }()

    private static func normalizeHex(_ rawHex: String?) -> String? {
        guard let rawHex else { return nil }
        let trimmed = rawHex
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        guard trimmed.hasPrefix("#"), trimmed.count == 7 else { return nil }
        return trimmed
    }
}
