//
//  BlockType.swift
//  Pillars
//
//  System-defined block type definitions — hardcoded, not Firestore
//

import Foundation

// MARK: - BlockInputKind

enum BlockInputKind {
    case sleep       // bespoke: duration stepper, quality slider, time pickers
    case sliders     // generic: labeled 0–10 sliders
    case checklist   // generic: checkable list with add/delete
    case textFields  // generic: labeled text fields
    case freeText    // generic: multiline TextEditor
}

// MARK: - BlockType

struct BlockType: Identifiable {
    let id: String
    let name: String
    let icon: String
    let description: String
    let defaultSection: DaySection.TimeSection
    let inputKind: BlockInputKind
}

// MARK: - All Block Types

extension BlockType {
    static let sleep = BlockType(
        id: "sleep",
        name: "Sleep",
        icon: "moon.zzz.fill",
        description: "Track your sleep duration, quality, and times.",
        defaultSection: .morning,
        inputKind: .sleep
    )

    static let feeling = BlockType(
        id: "feeling",
        name: "How I'm Feeling",
        icon: "heart.fill",
        description: "Rate your energy, mood, and stress levels.",
        defaultSection: .morning,
        inputKind: .sliders
    )

    static let morningHabits = BlockType(
        id: "morningHabits",
        name: "Morning Habits",
        icon: "sun.horizon.fill",
        description: "Check off your morning routine items.",
        defaultSection: .morning,
        inputKind: .checklist
    )

    static let workout = BlockType(
        id: "workout",
        name: "Workout",
        icon: "figure.run",
        description: "Log your exercise type, duration, and notes.",
        defaultSection: .afternoon,
        inputKind: .textFields
    )

    static let todos = BlockType(
        id: "todos",
        name: "To-Dos",
        icon: "checklist",
        description: "Track tasks and to-dos for the day.",
        defaultSection: .afternoon,
        inputKind: .checklist
    )

    static let event = BlockType(
        id: "event",
        name: "Event",
        icon: "calendar",
        description: "Log a notable event with title, time, and notes.",
        defaultSection: .afternoon,
        inputKind: .textFields
    )

    static let reflection = BlockType(
        id: "reflection",
        name: "Reflection",
        icon: "sparkles",
        description: "Free-write your thoughts and reflections.",
        defaultSection: .evening,
        inputKind: .freeText
    )

    static let notes = BlockType(
        id: "notes",
        name: "Notes",
        icon: "note.text",
        description: "Capture anything else worth recording.",
        defaultSection: .evening,
        inputKind: .freeText
    )

    static let all: [BlockType] = [
        .sleep, .feeling, .morningHabits,
        .workout, .todos, .event,
        .reflection, .notes
    ]

    static func find(_ id: String) -> BlockType? {
        all.first { $0.id == id }
    }
}
