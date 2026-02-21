//
//  CustomBlockView+Bindings.swift
//  Pillars
//
//  Read/write bindings for custom field values.
//  This is the bridge between UI controls and the block payload.
//

import SwiftUI

extension CustomBlockView {
    func bindingForText(fieldId: String) -> Binding<String> {
        Binding(
            get: {
                value(for: fieldId).textValue ?? ""
            },
            set: { newValue in
                mutateValue(for: fieldId) { value in
                    value.textValue = newValue
                    value.numberValue = nil
                    value.boolValue = nil
                }
            }
        )
    }

    func bindingForToggle(fieldId: String) -> Binding<Bool> {
        Binding(
            get: {
                value(for: fieldId).boolValue ?? false
            },
            set: { newValue in
                mutateValue(for: fieldId) { value in
                    value.textValue = nil
                    value.numberValue = nil
                    value.boolValue = newValue
                }
            }
        )
    }

    func bindingForNumber(_ field: BlockTypeFieldSchema) -> Binding<Double> {
        Binding(
            get: {
                let current = value(for: field.id).numberValue ?? defaultNumericValue(for: field)
                return clamped(current, for: field)
            },
            set: { newValue in
                mutateValue(for: field.id) { value in
                    value.textValue = nil
                    value.numberValue = clamped(newValue, for: field)
                    value.boolValue = nil
                }
            }
        )
    }

    func value(for fieldId: String) -> CustomFieldValue {
        if let current = block.customData?.first(where: { $0.id == fieldId }) {
            return current
        }

        if let field = typeDef.dataSchema.fields.first(where: { $0.id == fieldId }) {
            return defaultValue(for: field)
        }

        return CustomFieldValue(id: fieldId, textValue: nil, numberValue: nil, boolValue: nil)
    }

    func mutateValue(for fieldId: String, transform: (inout CustomFieldValue) -> Void) {
        var values = block.customData ?? []

        if let index = values.firstIndex(where: { $0.id == fieldId }) {
            transform(&values[index])
        } else if let field = typeDef.dataSchema.fields.first(where: { $0.id == fieldId }) {
            var newValue = defaultValue(for: field)
            transform(&newValue)
            values.append(newValue)
        } else {
            var newValue = CustomFieldValue(id: fieldId, textValue: nil, numberValue: nil, boolValue: nil)
            transform(&newValue)
            values.append(newValue)
        }

        block.customData = values
    }
}
