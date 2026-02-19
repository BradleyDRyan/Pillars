//
//  Block.swift
//  Pillars
//
//  A single filled-in logging block embedded within a Day
//

import Foundation

// MARK: - Block

struct Block: Identifiable, Codable {
    let id: String
    let typeId: String
    var order: Int
    var isExpanded: Bool

    var sleepData: SleepData?
    var sliderData: SliderData?
    var checklistData: ChecklistData?
    var textFieldData: TextFieldData?
    var freeText: String?

    var blockType: BlockType? { BlockType.find(typeId) }
}

// MARK: - SleepData

struct SleepData: Codable {
    var durationHours: Double  // 0–12, step 0.5
    var quality: Int           // 1–5
    var bedtime: String?       // "HH:mm"
    var wakeTime: String?      // "HH:mm"
}

// MARK: - SliderData

struct SliderData: Codable {
    var sliders: [SliderEntry]
}

struct SliderEntry: Identifiable, Codable {
    let id: String
    let label: String
    var value: Double  // 0–10
}

// MARK: - ChecklistData

struct ChecklistData: Codable {
    var items: [ChecklistItem]
}

struct ChecklistItem: Identifiable, Codable {
    let id: String
    var title: String
    var isCompleted: Bool
}

// MARK: - TextFieldData

struct TextFieldData: Codable {
    var fields: [TextFieldEntry]
}

struct TextFieldEntry: Identifiable, Codable {
    let id: String
    let label: String
    var value: String
    var isMultiline: Bool
}

// MARK: - Seeded Data Factories

extension Block {
    static func make(typeId: String, order: Int, defaultChecklistItems: [String]? = nil) -> Block {
        let id = UUID().uuidString
        var block = Block(
            id: id,
            typeId: typeId,
            order: order,
            isExpanded: false,
            sleepData: nil,
            sliderData: nil,
            checklistData: nil,
            textFieldData: nil,
            freeText: nil
        )

        switch typeId {
        case "sleep":
            block.sleepData = SleepData(durationHours: 8, quality: 3, bedtime: nil, wakeTime: nil)

        case "feeling":
            block.sliderData = SliderData(sliders: [
                SliderEntry(id: "energy", label: "Energy", value: 5),
                SliderEntry(id: "mood", label: "Mood", value: 5),
                SliderEntry(id: "stress", label: "Stress", value: 5)
            ])

        case "morningHabits":
            let items = (defaultChecklistItems ?? ["Exercise", "Meditate", "Read"])
                .enumerated()
                .map { ChecklistItem(id: UUID().uuidString, title: $1, isCompleted: false) }
            block.checklistData = ChecklistData(items: items)

        case "workout":
            block.textFieldData = TextFieldData(fields: [
                TextFieldEntry(id: "type", label: "Type", value: "", isMultiline: false),
                TextFieldEntry(id: "duration", label: "Duration", value: "", isMultiline: false),
                TextFieldEntry(id: "notes", label: "Notes", value: "", isMultiline: true)
            ])

        case "todos":
            let items = (defaultChecklistItems ?? [])
                .map { ChecklistItem(id: UUID().uuidString, title: $0, isCompleted: false) }
            block.checklistData = ChecklistData(items: items)

        case "event":
            block.textFieldData = TextFieldData(fields: [
                TextFieldEntry(id: "title", label: "Title", value: "", isMultiline: false),
                TextFieldEntry(id: "time", label: "Time", value: "", isMultiline: false),
                TextFieldEntry(id: "notes", label: "Notes", value: "", isMultiline: true)
            ])

        case "reflection", "notes":
            block.freeText = ""

        default:
            break
        }

        return block
    }
}
