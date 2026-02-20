//
//  Day.swift
//  Pillars
//
//  A calendar day containing sections of logging blocks
//

import Foundation

// MARK: - TimeSection

extension DaySection {
    enum TimeSection: String, Codable, CaseIterable, Identifiable {
        case morning
        case afternoon
        case evening

        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .morning: return "Morning"
            case .afternoon: return "Afternoon"
            case .evening: return "Evening"
            }
        }

        var icon: String {
            switch self {
            case .morning: return "sunrise.fill"
            case .afternoon: return "sun.max.fill"
            case .evening: return "moon.stars.fill"
            }
        }

        var timeRange: String {
            switch self {
            case .morning: return "6am–12pm"
            case .afternoon: return "12pm–6pm"
            case .evening: return "6pm–12am"
            }
        }
    }
}

// MARK: - DaySection

struct DaySection: Codable, Identifiable {
    var id: TimeSection
    var blocks: [Block]
}

// MARK: - Day

struct Day: Identifiable, Codable {
    let id: String
    let userId: String
    let date: String       // "2026-02-19" (local timezone)
    var templateId: String?
    var sections: [DaySection]
    let createdAt: Date
    var updatedAt: Date
}

// MARK: - Factory

extension Day {
    /// Today's date string in local timezone: "2026-02-19"
    static var todayDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter.string(from: Date())
    }
}
