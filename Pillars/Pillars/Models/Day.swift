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
    static func from(template: DayTemplate, userId: String, date: String) -> Day {
        let now = Date()
        var sections: [DaySection] = []

        for sectionDef in template.sections {
            var blocks: [Block] = []
            for entry in sectionDef.entries.sorted(by: { $0.order < $1.order }) {
                let block = Block.make(
                    typeId: entry.blockTypeId,
                    order: entry.order,
                    defaultChecklistItems: entry.defaultChecklistItems
                )
                blocks.append(block)
            }
            sections.append(DaySection(id: sectionDef.id, blocks: blocks))
        }

        // Ensure all 3 sections present
        for section in DaySection.TimeSection.allCases {
            if !sections.contains(where: { $0.id == section }) {
                sections.append(DaySection(id: section, blocks: []))
            }
        }
        sections.sort { $0.id.rawValue < $1.id.rawValue }

        return Day(
            id: UUID().uuidString,
            userId: userId,
            date: date,
            templateId: template.id,
            sections: sections,
            createdAt: now,
            updatedAt: now
        )
    }

    /// Today's date string in local timezone: "2026-02-19"
    static var todayDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter.string(from: Date())
    }

    /// Firestore-serializable dictionary
    func toFirestoreData() -> [String: Any] {
        var sectionsData: [[String: Any]] = []
        for section in sections {
            var blocksData: [[String: Any]] = []
            for block in section.blocks {
                if let data = try? JSONEncoder().encode(block),
                   let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    blocksData.append(dict)
                }
            }
            sectionsData.append([
                "id": section.id.rawValue,
                "blocks": blocksData
            ])
        }
        return [
            "id": id,
            "userId": userId,
            "date": date,
            "templateId": templateId as Any,
            "sections": sectionsData,
            "createdAt": createdAt.timeIntervalSince1970,
            "updatedAt": updatedAt.timeIntervalSince1970
        ]
    }
}
