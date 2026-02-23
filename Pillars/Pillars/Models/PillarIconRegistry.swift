import Foundation

enum PillarIconRegistry {
    static let fallbackSystemName = "questionmark.circle"
    static let fallbackToken = PillarIcon.default.rawValue

    static func normalizeToken(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let trimmed = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return trimmed.isEmpty ? nil : trimmed
    }

    static func resolvedToken(_ raw: String?) -> String {
        guard let normalized = normalizeToken(raw) else {
            return fallbackToken
        }
        if PillarIcon.resolve(normalized) != nil {
            return normalized
        }
        return normalized
    }

    static func systemName(for token: String?) -> String {
        let normalized = normalizeToken(token)
        if let normalized, let icon = PillarIcon.resolve(normalized) {
            return icon.systemName
        }
        return fallbackSystemName
    }

    static func label(for token: String?) -> String {
        let normalized = normalizeToken(token)
        if let normalized, let icon = PillarIcon.resolve(normalized) {
            return icon.displayName
        }
        if let normalized {
            return normalized
                .replacingOccurrences(of: "_", with: " ")
                .capitalized
        }
        return "Pillar"
    }

    static func defaultColorToken(for token: String?) -> String {
        let normalized = normalizeToken(token)
        if let normalized,
           let icon = PillarIcon.resolve(normalized),
           let resolved = PillarColorRegistry.token(forHex: icon.defaultColor.toHex()) {
            return resolved
        }
        return PillarColorRegistry.fallbackToken
    }
}
