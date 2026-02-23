import Foundation

struct PillarVisualColor: Codable, Hashable, Identifiable {
    let id: String
    let label: String
    let order: Int
    let isActive: Bool
}

struct PillarVisualIcon: Codable, Hashable, Identifiable {
    let id: String
    let label: String
    let defaultColorToken: String?
    let order: Int
    let isActive: Bool
}

struct PillarVisualsResponse: Codable, Hashable {
    let endpoint: String
    let source: String
    let updatedAt: Int
    let colors: [PillarVisualColor]
    let icons: [PillarVisualIcon]
}
