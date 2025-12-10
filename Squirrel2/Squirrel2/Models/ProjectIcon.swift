//
//  ProjectIcon.swift
//  Squirrel2
//
//  Enum-based project icons for cross-platform consistency
//  Each case maps to a platform-specific asset in Assets.xcassets/ProjectIcons/
//

import SwiftUI

enum ProjectIcon: String, Codable, CaseIterable, Identifiable {
    case folder  // Default
    case health
    case money
    
    var id: String { rawValue }
    
    /// Asset name in Assets.xcassets/ProjectIcons/
    var assetName: String {
        switch self {
        case .folder: return "Folder"
        case .health: return "Health"
        case .money: return "Money"
        }
    }
    
    /// Display name for the picker
    var displayName: String {
        switch self {
        case .folder: return "Folder"
        case .health: return "Health"
        case .money: return "Money"
        }
    }
    
    /// The default icon for new projects
    static var `default`: ProjectIcon { .folder }
}

// MARK: - SwiftUI View Helper
extension ProjectIcon {
    /// Returns the icon as a SwiftUI Image from assets (tintable via .foregroundColor)
    @ViewBuilder
    func iconView(size: CGFloat = 24) -> some View {
        Image(assetName)
            .renderingMode(.template)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
    }
}
