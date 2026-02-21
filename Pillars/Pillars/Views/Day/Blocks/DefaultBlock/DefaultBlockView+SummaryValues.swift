//
//  DefaultBlockView+SummaryValues.swift
//  Pillars
//
//  Compact summary text logic for collapsed rows.
//  Example outputs: 80%, Set, On, 7.5.
//

import Foundation

extension DefaultBlockView {
    func builtInCollapsedValue(for builtIn: BlockType) -> String? {
        switch builtIn.inputKind {
        case .sleep:
            guard let data = block.sleepData else { return nil }
            let percent = Int(round((Double(data.quality) / 5.0) * 100))
            return "\(percent)%"

        case .sliders:
            guard let sliders = block.sliderData?.sliders, !sliders.isEmpty else { return nil }
            let average = sliders.map(\.value).reduce(0, +) / Double(sliders.count)
            return percentString(value: average, min: 0, max: 10)

        case .checklist:
            guard let items = block.checklistData?.items, !items.isEmpty else { return nil }
            let completed = items.filter(\.isCompleted).count
            let percent = Int(round((Double(completed) / Double(items.count)) * 100))
            return "\(percent)%"

        case .textFields:
            guard let fields = block.textFieldData?.fields, !fields.isEmpty else { return nil }
            let filledCount = fields.filter { nonEmpty($0.value) != nil }.count
            let percent = Int(round((Double(filledCount) / Double(fields.count)) * 100))
            return "\(percent)%"

        case .freeText:
            return nonEmpty(block.freeText) == nil ? nil : "Set"

        case .custom:
            return nil
        }
    }

    func customCollapsedValue(for type: BlockType) -> String? {
        guard let values = block.customData else { return nil }

        for field in type.dataSchema.fields {
            guard let value = values.first(where: { $0.id == field.id }) else { continue }

            switch field.fieldKind {
            case .slider:
                if let number = value.numberValue {
                    let lower = field.min ?? 0
                    let upper = field.max ?? 10
                    return percentString(value: number, min: lower, max: upper)
                }

            case .rating:
                if let number = value.numberValue {
                    let lower = field.min ?? 1
                    let upper = field.max ?? 5
                    return percentString(value: number, min: lower, max: upper)
                }

            case .number:
                if let number = value.numberValue {
                    return formatNumber(number)
                }

            case .toggle:
                if let boolValue = value.boolValue {
                    return boolValue ? "On" : "Off"
                }

            case .text, .multiline:
                if nonEmpty(value.textValue) != nil {
                    return "Set"
                }
            }
        }

        return nil
    }

    // Returns nil for empty or whitespace-only values.
    func nonEmpty(_ string: String?) -> String? {
        guard let string else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    func percentString(value: Double, min: Double, max: Double) -> String {
        guard max > min else {
            return "\(Int(round(value)))%"
        }

        let clampedValue = Swift.max(min, Swift.min(max, value))
        let ratio = (clampedValue - min) / (max - min)
        let percent = Int(round(ratio * 100))
        return "\(percent)%"
    }

    func formatNumber(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(format: "%.1f", value)
    }
}
