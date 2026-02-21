//
//  Habit.swift
//  Pillars
//
//  Habit primitive models used by the Habits tab.
//

import Foundation

struct Habit: Decodable, Identifiable {
    let id: String
    let userId: String?
    let name: String
    let description: String?
    let sectionId: String?
    let order: Int?
    let schedule: HabitSchedule?
    let target: HabitTarget?
    let isActive: Bool?
    let pillarId: String?
    let bountyPoints: Int?
    let bountyPillarId: String?
    let bountyReason: String?
    let bountyAllocations: [HabitBountyAllocation]?
    let groupId: String?
    let groupName: String?
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?
    let archivedAt: TimeInterval?

    var section: DaySection.TimeSection {
        guard let sectionId else { return .morning }
        return DaySection.TimeSection(rawValue: sectionId) ?? .morning
    }

    var isArchived: Bool {
        archivedAt != nil || isActive == false
    }
}

struct HabitSchedule: Decodable {
    let type: String?
    let daysOfWeek: [String]?

    var normalizedType: String {
        (type ?? "daily").lowercased()
    }

    var normalizedDaysOfWeek: [String] {
        (daysOfWeek ?? []).map { $0.lowercased() }
    }
}

struct HabitTarget: Decodable {
    let type: String?
    let value: Double?
    let unit: String?
}

struct HabitBountyAllocation: Decodable, Hashable {
    let pillarId: String
    let points: Int
}

struct HabitLog: Decodable, Identifiable {
    private let rawId: String?
    let userId: String?
    let habitId: String
    let date: String
    let completed: Bool
    let status: HabitLogStatus?
    let value: Double?
    let notes: String?
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?

    var displayStatus: HabitLogStatus {
        if let status {
            return status
        }

        if completed {
            return .completed
        }

        return .pending
    }

    var isCompleted: Bool {
        displayStatus == .completed
    }

    var isSkipped: Bool {
        displayStatus == .skipped
    }

    var id: String {
        rawId ?? "\(habitId)_\(date)"
    }

    init(
        id: String? = nil,
        userId: String?,
        habitId: String,
        date: String,
        completed: Bool,
        status: HabitLogStatus? = nil,
        value: Double?,
        notes: String?,
        createdAt: TimeInterval?,
        updatedAt: TimeInterval?
    ) {
        self.rawId = id
        self.userId = userId
        self.habitId = habitId
        self.date = date
        self.completed = completed
        self.status = status
        self.value = value
        self.notes = notes
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case rawId = "id"
        case userId
        case habitId
        case date
        case completed
        case status
        case value
        case notes
        case createdAt
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawId = try container.decodeIfPresent(String.self, forKey: .rawId)
        let userId = try container.decodeIfPresent(String.self, forKey: .userId)
        let habitId = try container.decode(String.self, forKey: .habitId)
        let date = try container.decode(String.self, forKey: .date)
        let completed = try container.decode(Bool.self, forKey: .completed)
        let status = try container.decodeIfPresent(String.self, forKey: .status).flatMap(HabitLogStatus.init)
        let value = try container.decodeIfPresent(Double.self, forKey: .value)
        let notes = try container.decodeIfPresent(String.self, forKey: .notes)
        let createdAt = try container.decodeIfPresent(TimeInterval.self, forKey: .createdAt)
        let updatedAt = try container.decodeIfPresent(TimeInterval.self, forKey: .updatedAt)

        self.init(
            id: rawId,
            userId: userId,
            habitId: habitId,
            date: date,
            completed: completed,
            status: status,
            value: value,
            notes: notes,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

enum HabitLogStatus: String, Decodable {
    case completed
    case skipped
    case pending
}

struct ScheduledHabit: Decodable, Identifiable {
    let id: String
    let userId: String?
    let name: String
    let description: String?
    let sectionId: String?
    let order: Int?
    let schedule: HabitSchedule?
    let target: HabitTarget?
    let isActive: Bool?
    let pillarId: String?
    let bountyPoints: Int?
    let bountyPillarId: String?
    let bountyReason: String?
    let bountyAllocations: [HabitBountyAllocation]?
    let groupId: String?
    let groupName: String?
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?
    let archivedAt: TimeInterval?
    let log: HabitLog

    var section: DaySection.TimeSection {
        guard let sectionId else { return .morning }
        return DaySection.TimeSection(rawValue: sectionId) ?? .morning
    }

    var isCompleted: Bool {
        log.isCompleted
    }

    var isSkipped: Bool {
        log.isSkipped
    }

    var isArchived: Bool {
        archivedAt != nil || isActive == false
    }
}

enum HabitScheduleType: String, CaseIterable, Identifiable {
    case daily
    case weekly

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .daily:
            return "Daily"
        case .weekly:
            return "Weekly"
        }
    }
}

enum HabitTargetType: String, CaseIterable, Identifiable {
    case binary
    case count
    case duration

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .binary:
            return "Check"
        case .count:
            return "Count"
        case .duration:
            return "Duration"
        }
    }
}

enum HabitWeekday: String, CaseIterable, Identifiable {
    case sunday
    case monday
    case tuesday
    case wednesday
    case thursday
    case friday
    case saturday

    var id: String { rawValue }

    var shortLabel: String {
        switch self {
        case .sunday:
            return "Sun"
        case .monday:
            return "Mon"
        case .tuesday:
            return "Tue"
        case .wednesday:
            return "Wed"
        case .thursday:
            return "Thu"
        case .friday:
            return "Fri"
        case .saturday:
            return "Sat"
        }
    }
}

struct HabitCreateInput {
    let title: String
    let groupId: String?
    let newGroupName: String?
    let scheduleType: HabitScheduleType
    let daysOfWeek: [HabitWeekday]
    let targetType: HabitTargetType
    let targetValue: Double
    let targetUnit: String?
    let pillarId: String?
    let bountyPoints: Int?
    let bountyReason: String?

    init(
        title: String,
        groupId: String?,
        newGroupName: String?,
        scheduleType: HabitScheduleType,
        daysOfWeek: [HabitWeekday],
        targetType: HabitTargetType,
        targetValue: Double,
        targetUnit: String?,
        pillarId: String?,
        bountyPoints: Int? = nil,
        bountyReason: String? = nil
    ) {
        self.title = title
        self.groupId = groupId
        self.newGroupName = newGroupName
        self.scheduleType = scheduleType
        self.daysOfWeek = daysOfWeek
        self.targetType = targetType
        self.targetValue = targetValue
        self.targetUnit = targetUnit
        self.pillarId = pillarId
        self.bountyPoints = bountyPoints
        self.bountyReason = bountyReason
    }
}

struct HabitGroup: Decodable, Identifiable {
    let id: String
    let userId: String?
    let name: String
    let createdAt: TimeInterval?
    let updatedAt: TimeInterval?
    let archivedAt: TimeInterval?

    var isArchived: Bool {
        archivedAt != nil
    }
}
