//
//  Block.swift
//  Pillars
//
//  Unified Block instance model for Block System v1.
//

import Foundation

// MARK: - JSONValue

enum JSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
            return
        }

        if let boolValue = try? container.decode(Bool.self) {
            self = .bool(boolValue)
            return
        }

        if let numberValue = try? container.decode(Double.self) {
            self = .number(numberValue)
            return
        }

        if let stringValue = try? container.decode(String.self) {
            self = .string(stringValue)
            return
        }

        if let arrayValue = try? container.decode([JSONValue].self) {
            self = .array(arrayValue)
            return
        }

        if let objectValue = try? container.decode([String: JSONValue].self) {
            self = .object(objectValue)
            return
        }

        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Unsupported JSONValue"
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var numberValue: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    func asAnyValue() -> Any {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return value
        case .bool(let value):
            return value
        case .object(let value):
            return value.mapValues { $0.asAnyValue() }
        case .array(let value):
            return value.map { $0.asAnyValue() }
        case .null:
            return NSNull()
        }
    }

    static func fromAny(_ value: Any) -> JSONValue {
        switch value {
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .bool(number.boolValue)
            }
            return .number(number.doubleValue)
        case let string as String:
            return .string(string)
        case let bool as Bool:
            return .bool(bool)
        case let dict as [String: Any]:
            return .object(dict.mapValues { JSONValue.fromAny($0) })
        case let array as [Any]:
            return .array(array.map { JSONValue.fromAny($0) })
        default:
            return .null
        }
    }
}

// MARK: - Block

struct Block: Identifiable, Codable {
    struct ResolvedPillar: Codable {
        let id: String
        let name: String?
        let icon: String?
        let color: String?
    }

    let id: String
    var typeId: String
    var sectionId: DaySection.TimeSection?
    var order: Int
    var isExpanded: Bool

    var title: String?
    var subtitle: String?
    var icon: String?
    var pillarId: String?
    var source: String?
    var data: [String: JSONValue]

    var resolvedTitle: String?
    var resolvedSubtitle: String?
    var resolvedIcon: String?
    var pillar: ResolvedPillar?
    var isProjected: Bool?

    var blockType: BlockType? { BlockType.find(typeId) }

    var displayTitle: String {
        resolvedTitle ?? title ?? blockType?.name ?? "Block"
    }

    var displaySubtitle: String? {
        resolvedSubtitle ?? subtitle
    }

    var displayIcon: String {
        resolvedIcon ?? icon ?? blockType?.icon ?? "square.grid.2x2"
    }
}

// MARK: - SleepData

struct SleepData: Codable {
    var durationHours: Double
    var quality: Int
    var bedtime: String?
    var wakeTime: String?
}

// MARK: - SliderData

struct SliderData: Codable {
    var sliders: [SliderEntry]
}

struct SliderEntry: Identifiable, Codable {
    let id: String
    let label: String
    var value: Double
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

// MARK: - CustomFieldValue

struct CustomFieldValue: Identifiable, Codable, Equatable {
    let id: String
    var textValue: String?
    var numberValue: Double?
    var boolValue: Bool?
}

// MARK: - Legacy Editor Adapters

extension Block {
    var sleepData: SleepData? {
        get {
            guard typeId == "sleep" else { return nil }
            return SleepData(
                durationHours: dataValueDouble("durationHours") ?? 8,
                quality: Int((dataValueDouble("quality") ?? 3).rounded()),
                bedtime: dataValueString("bedtime"),
                wakeTime: dataValueString("wakeTime")
            )
        }
        set {
            guard typeId == "sleep" else { return }
            guard let newValue else {
                data.removeAll()
                return
            }

            data["durationHours"] = .number(newValue.durationHours)
            data["quality"] = .number(Double(newValue.quality))
            if let bedtime = normalizedOptionalString(newValue.bedtime) {
                data["bedtime"] = .string(bedtime)
            } else {
                data.removeValue(forKey: "bedtime")
            }

            if let wakeTime = normalizedOptionalString(newValue.wakeTime) {
                data["wakeTime"] = .string(wakeTime)
            } else {
                data.removeValue(forKey: "wakeTime")
            }
        }
    }

    var sliderData: SliderData? {
        get {
            if let sliders = data["sliders"]?.arrayValue {
                let entries = sliders.compactMap { raw -> SliderEntry? in
                    guard let object = raw.objectValue else { return nil }
                    guard let id = object["id"]?.stringValue,
                          let label = object["label"]?.stringValue else {
                        return nil
                    }
                    let value = object["value"]?.numberValue ?? 0
                    return SliderEntry(id: id, label: label, value: value)
                }
                if !entries.isEmpty {
                    return SliderData(sliders: entries)
                }
            }

            if typeId == "feeling" {
                let fallback = [
                    SliderEntry(id: "energy", label: "Energy", value: dataValueDouble("energy") ?? 5),
                    SliderEntry(id: "mood", label: "Mood", value: dataValueDouble("mood") ?? 5),
                    SliderEntry(id: "stress", label: "Stress", value: dataValueDouble("stress") ?? 5)
                ]
                return SliderData(sliders: fallback)
            }

            return nil
        }
        set {
            guard let newValue else {
                data.removeValue(forKey: "sliders")
                data.removeValue(forKey: "energy")
                data.removeValue(forKey: "mood")
                data.removeValue(forKey: "stress")
                return
            }

            let sliders = newValue.sliders.map { slider in
                JSONValue.object([
                    "id": .string(slider.id),
                    "label": .string(slider.label),
                    "value": .number(slider.value)
                ])
            }
            data["sliders"] = .array(sliders)

            for slider in newValue.sliders {
                let lower = slider.id.lowercased()
                if lower == "energy" || lower == "mood" || lower == "stress" {
                    data[lower] = .number(slider.value)
                }
            }
        }
    }

    var checklistData: ChecklistData? {
        get {
            if typeId == "todo" {
                let title = dataValueString("title") ?? ""
                let status = (dataValueString("status") ?? "active").lowercased()
                var items: [ChecklistItem] = [
                    ChecklistItem(
                        id: dataValueString("todoId") ?? id,
                        title: title,
                        isCompleted: status == "completed"
                    )
                ]

                if let subtasks = data["subtasks"]?.arrayValue {
                    for task in subtasks {
                        guard let object = task.objectValue else { continue }
                        let taskId = object["id"]?.stringValue ?? UUID().uuidString
                        let taskTitle = object["title"]?.stringValue ?? ""
                        let isCompleted = object["completed"]?.boolValue
                            ?? ((object["status"]?.stringValue ?? "").lowercased() == "completed")
                        items.append(
                            ChecklistItem(id: taskId, title: taskTitle, isCompleted: isCompleted)
                        )
                    }
                }

                return ChecklistData(items: items)
            }

            if typeId == "habits" {
                let habitId = dataValueString("habitId") ?? id
                let name = dataValueString("name") ?? ""
                let completed = data["completed"]?.boolValue ?? false
                return ChecklistData(items: [ChecklistItem(id: habitId, title: name, isCompleted: completed)])
            }

            if let items = data["items"]?.arrayValue {
                let decoded = items.compactMap { raw -> ChecklistItem? in
                    guard let object = raw.objectValue else { return nil }
                    let itemId = object["id"]?.stringValue ?? UUID().uuidString
                    let title = object["title"]?.stringValue ?? ""
                    let completed = object["isCompleted"]?.boolValue ?? object["completed"]?.boolValue ?? false
                    return ChecklistItem(id: itemId, title: title, isCompleted: completed)
                }
                return ChecklistData(items: decoded)
            }

            return nil
        }
        set {
            guard let newValue else {
                data.removeValue(forKey: "items")
                data.removeValue(forKey: "title")
                data.removeValue(forKey: "status")
                data.removeValue(forKey: "name")
                data.removeValue(forKey: "completed")
                data.removeValue(forKey: "subtasks")
                return
            }

            if typeId == "todo" {
                let root = newValue.items.first
                data["title"] = .string(root?.title ?? "")
                data["status"] = .string((root?.isCompleted ?? false) ? "completed" : "active")

                let subtasks = newValue.items.dropFirst().map { item in
                    JSONValue.object([
                        "id": .string(item.id),
                        "title": .string(item.title),
                        "completed": .bool(item.isCompleted),
                        "status": .string(item.isCompleted ? "completed" : "active")
                    ])
                }
                data["subtasks"] = .array(Array(subtasks))
                return
            }

            if typeId == "habits" {
                let first = newValue.items.first
                data["name"] = .string(first?.title ?? "")
                data["completed"] = .bool(first?.isCompleted ?? false)
                data["status"] = .string((first?.isCompleted ?? false) ? "completed" : "pending")
                return
            }

            data["items"] = .array(newValue.items.map { item in
                .object([
                    "id": .string(item.id),
                    "title": .string(item.title),
                    "isCompleted": .bool(item.isCompleted)
                ])
            })
        }
    }

    var textFieldData: TextFieldData? {
        get {
            if typeId == "workout" {
                return TextFieldData(fields: [
                    TextFieldEntry(id: "type", label: "Type", value: dataValueString("type") ?? "", isMultiline: false),
                    TextFieldEntry(id: "duration", label: "Duration", value: dataValueString("duration") ?? "", isMultiline: false),
                    TextFieldEntry(id: "notes", label: "Notes", value: dataValueString("notes") ?? "", isMultiline: true)
                ])
            }

            if let fields = data["fields"]?.arrayValue {
                let decoded = fields.compactMap { raw -> TextFieldEntry? in
                    guard let object = raw.objectValue,
                          let id = object["id"]?.stringValue,
                          let label = object["label"]?.stringValue else {
                        return nil
                    }
                    let value = object["value"]?.stringValue ?? ""
                    let isMultiline = object["isMultiline"]?.boolValue ?? false
                    return TextFieldEntry(id: id, label: label, value: value, isMultiline: isMultiline)
                }
                return TextFieldData(fields: decoded)
            }

            return nil
        }
        set {
            guard let newValue else {
                data.removeValue(forKey: "fields")
                data.removeValue(forKey: "type")
                data.removeValue(forKey: "duration")
                data.removeValue(forKey: "notes")
                return
            }

            if typeId == "workout" {
                for field in newValue.fields {
                    data[field.id] = .string(field.value)
                }
            }

            data["fields"] = .array(newValue.fields.map { field in
                .object([
                    "id": .string(field.id),
                    "label": .string(field.label),
                    "value": .string(field.value),
                    "isMultiline": .bool(field.isMultiline)
                ])
            })
        }
    }

    var freeText: String? {
        get {
            dataValueString("freeText")
        }
        set {
            if let value = normalizedOptionalString(newValue) {
                data["freeText"] = .string(value)
            } else {
                data.removeValue(forKey: "freeText")
            }
        }
    }

    var customData: [CustomFieldValue]? {
        get {
            guard let fields = data["fields"]?.arrayValue else { return nil }
            let values = fields.compactMap { raw -> CustomFieldValue? in
                guard let object = raw.objectValue,
                      let id = object["id"]?.stringValue else {
                    return nil
                }
                return CustomFieldValue(
                    id: id,
                    textValue: object["textValue"]?.stringValue,
                    numberValue: object["numberValue"]?.numberValue,
                    boolValue: object["boolValue"]?.boolValue
                )
            }
            return values
        }
        set {
            guard let newValue else {
                data.removeValue(forKey: "fields")
                return
            }

            data["fields"] = .array(newValue.map { value in
                var object: [String: JSONValue] = ["id": .string(value.id)]
                object["textValue"] = value.textValue.map(JSONValue.string) ?? .null
                object["numberValue"] = value.numberValue.map(JSONValue.number) ?? .null
                object["boolValue"] = value.boolValue.map(JSONValue.bool) ?? .null
                return .object(object)
            })
        }
    }

    func dataDictionary() -> [String: Any] {
        data.mapValues { $0.asAnyValue() }
    }

    private func dataValueString(_ key: String) -> String? {
        data[key]?.stringValue
    }

    private func dataValueDouble(_ key: String) -> Double? {
        data[key]?.numberValue
    }

    private func normalizedOptionalString(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

// MARK: - Seeded Data Factories

extension Block {
    static func make(
        typeId: String,
        sectionId: DaySection.TimeSection,
        order: Int,
        customType: BlockType? = nil
    ) -> Block {
        let id = UUID().uuidString
        var data: [String: JSONValue] = [:]

        switch typeId {
        case "sleep":
            data = [
                "durationHours": .number(8),
                "quality": .number(3),
                "source": .string("manual")
            ]

        case "feeling":
            data = [
                "energy": .number(5),
                "mood": .number(5),
                "stress": .number(5),
                "sliders": .array([
                    .object(["id": .string("energy"), "label": .string("Energy"), "value": .number(5)]),
                    .object(["id": .string("mood"), "label": .string("Mood"), "value": .number(5)]),
                    .object(["id": .string("stress"), "label": .string("Stress"), "value": .number(5)])
                ])
            ]

        case "workout":
            data = [
                "type": .string(""),
                "duration": .string(""),
                "notes": .string(""),
                "source": .string("manual")
            ]

        case "reflection":
            data = ["freeText": .string("")]

        case "todo":
            data = [
                "title": .string(""),
                "status": .string("active")
            ]

        case "habits":
            data = [
                "name": .string(""),
                "completed": .bool(false),
                "status": .string("pending")
            ]

        default:
            if let customType {
                data = [
                    "fields": .array(makeCustomData(from: customType.dataSchema.fields).map { value in
                        var object: [String: JSONValue] = ["id": .string(value.id)]
                        object["textValue"] = value.textValue.map(JSONValue.string) ?? .null
                        object["numberValue"] = value.numberValue.map(JSONValue.number) ?? .null
                        object["boolValue"] = value.boolValue.map(JSONValue.bool) ?? .null
                        return .object(object)
                    })
                ]
            }
        }

        return Block(
            id: id,
            typeId: typeId,
            sectionId: sectionId,
            order: order,
            isExpanded: false,
            title: nil,
            subtitle: nil,
            icon: nil,
            pillarId: nil,
            source: "user",
            data: data,
            resolvedTitle: nil,
            resolvedSubtitle: nil,
            resolvedIcon: nil,
            pillar: nil,
            isProjected: false
        )
    }

    private static func makeCustomData(from fields: [BlockTypeFieldSchema]) -> [CustomFieldValue] {
        fields.map { field in
            switch field.fieldKind {
            case .text, .multiline:
                return CustomFieldValue(id: field.id, textValue: "", numberValue: nil, boolValue: nil)
            case .number, .slider, .rating:
                return CustomFieldValue(id: field.id, textValue: nil, numberValue: field.min ?? 0, boolValue: nil)
            case .toggle:
                return CustomFieldValue(id: field.id, textValue: nil, numberValue: nil, boolValue: false)
            }
        }
    }
}
