//
//  PillarIcon.swift
//  Pillars
//
//  Icons for pillars - supports both SF Symbols and emoji
//

import SwiftUI

enum PillarIcon: String, Codable, CaseIterable, Identifiable {
    // Life domains
    case heart       // Relationships, Love
    case house       // Home
    case briefcase   // Career, Work
    case figure2     // Family
    case dollarsign  // Finances
    case brain       // Mind, Learning
    case figure      // Health, Fitness
    case book        // Education
    case sparkles    // Creativity
    case leaf        // Growth, Nature
    case star        // Goals, Aspirations
    case globe       // Travel, World
    
    var id: String { rawValue }
    
    /// SF Symbol name
    var systemName: String {
        switch self {
        case .heart: return "heart.fill"
        case .house: return "house.fill"
        case .briefcase: return "briefcase.fill"
        case .figure2: return "figure.2"
        case .dollarsign: return "dollarsign.circle.fill"
        case .brain: return "brain.head.profile"
        case .figure: return "figure.walk"
        case .book: return "book.fill"
        case .sparkles: return "sparkles"
        case .leaf: return "leaf.fill"
        case .star: return "star.fill"
        case .globe: return "globe"
        }
    }
    
    /// Default color for this icon type
    var defaultColor: Color {
        switch self {
        case .heart: return Color(hex: "FF6B6B")
        case .house: return Color(hex: "4DABF7")
        case .briefcase: return Color(hex: "868E96")
        case .figure2: return Color(hex: "CC5DE8")
        case .dollarsign: return Color(hex: "51CF66")
        case .brain: return Color(hex: "FF922B")
        case .figure: return Color(hex: "20C997")
        case .book: return Color(hex: "845EF7")
        case .sparkles: return Color(hex: "FAB005")
        case .leaf: return Color(hex: "40C057")
        case .star: return Color(hex: "FCC419")
        case .globe: return Color(hex: "339AF0")
        }
    }
    
    /// Display name for picker
    var displayName: String {
        switch self {
        case .heart: return "Heart"
        case .house: return "Home"
        case .briefcase: return "Work"
        case .figure2: return "Family"
        case .dollarsign: return "Finances"
        case .brain: return "Mind"
        case .figure: return "Health"
        case .book: return "Learning"
        case .sparkles: return "Creativity"
        case .leaf: return "Growth"
        case .star: return "Goals"
        case .globe: return "Travel"
        }
    }
    
    static var `default`: PillarIcon { .star }
}

// MARK: - SwiftUI View Helper
extension PillarIcon {
    @ViewBuilder
    func iconView(size: CGFloat = 24, color: Color? = nil) -> some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.6, weight: .medium))
            .foregroundColor(color ?? defaultColor)
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: size * 0.25)
                    .fill((color ?? defaultColor).opacity(0.15))
            )
    }
}




