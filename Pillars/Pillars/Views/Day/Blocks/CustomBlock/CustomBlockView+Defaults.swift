//
//  CustomBlockView+Defaults.swift
//  Pillars
//
//  Default values and safety rules for custom fields.
//  This keeps data valid even when a field has no saved value yet.
//

import Foundation

extension CustomBlockView {
    // Fills in any missing field values so every schema field has a value record.
    func hydrateMissingValues() {
        let current = block.customData ?? []
        let currentMap = Dictionary(uniqueKeysWithValues: current.map { ($0.id, $0) })
        let hydrated = typeDef.dataSchema.fields.map { field in
            currentMap[field.id] ?? defaultValue(for: field)
        }

        if block.customData != hydrated {
            block.customData = hydrated
        }
    }

    func defaultValue(for field: BlockTypeFieldSchema) -> CustomFieldValue {
        switch field.fieldKind {
        case .text, .multiline:
            return CustomFieldValue(
                id: field.id,
                textValue: "",
                numberValue: nil,
                boolValue: nil
            )

        case .number, .slider, .rating:
            return CustomFieldValue(
                id: field.id,
                textValue: nil,
                numberValue: defaultNumericValue(for: field),
                boolValue: nil
            )

        case .toggle:
            return CustomFieldValue(
                id: field.id,
                textValue: nil,
                numberValue: nil,
                boolValue: false
            )
        }
    }

    func defaultNumericValue(for field: BlockTypeFieldSchema) -> Double {
        if let min = field.min {
            return min
        }

        switch field.fieldKind {
        case .rating:
            return 1
        default:
            return 0
        }
    }

    // Keeps numeric values inside allowed min/max ranges.
    func clamped(_ value: Double, for field: BlockTypeFieldSchema) -> Double {
        var nextValue = value

        if let minValue = field.min {
            nextValue = max(nextValue, minValue)
        } else if field.fieldKind == .rating {
            nextValue = max(nextValue, 1)
        }

        if let maxValue = field.max {
            nextValue = min(nextValue, maxValue)
        } else if field.fieldKind == .rating {
            nextValue = min(nextValue, 5)
        }

        if field.fieldKind == .rating {
            return nextValue.rounded()
        }
        return nextValue
    }

    func sliderRange(for field: BlockTypeFieldSchema) -> ClosedRange<Double> {
        let lowerBound = field.min ?? 0
        let fallbackUpper: Double = field.fieldKind == .rating ? 5 : 10
        let upperBound = max(lowerBound, field.max ?? fallbackUpper)
        return lowerBound...upperBound
    }

    func stepValue(for field: BlockTypeFieldSchema) -> Double {
        if field.fieldKind == .rating {
            return 1
        }
        return 1
    }
}
