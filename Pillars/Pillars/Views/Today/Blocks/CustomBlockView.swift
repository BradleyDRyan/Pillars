//
//  CustomBlockView.swift
//  Pillars
//
//  Dynamic renderer for Firestore-backed custom block types
//

import SwiftUI

struct CustomBlockView: View {
    @Binding var block: Block
    let typeDef: CustomBlockType

    var body: some View {
        VStack(spacing: S2.MyDay.Spacing.contentStack) {
            ForEach(typeDef.fields) { field in
                fieldEditor(for: field)
            }
        }
        .onAppear(perform: hydrateMissingValues)
    }

    @ViewBuilder
    private func fieldEditor(for field: CustomFieldDef) -> some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.fieldStack) {
            S2MyDayFieldLabel(text: field.label)

            switch field.type {
            case .text:
                TextField(field.placeholder ?? field.label, text: bindingForText(fieldId: field.id))
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .s2MyDayInputSurface()

            case .multiline:
                multilineEditor(for: field)

            case .number:
                TextField(field.placeholder ?? field.label, value: bindingForNumber(field), format: .number)
                    .keyboardType(.decimalPad)
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .s2MyDayInputSurface()

            case .slider:
                VStack(spacing: S2.Spacing.sm) {
                    HStack {
                        Text(String(format: "%.1f", bindingForNumber(field).wrappedValue))
                            .font(S2.MyDay.Typography.valueStrong)
                            .foregroundColor(S2.MyDay.Colors.titleText)
                        Spacer()
                    }
                    Slider(
                        value: bindingForNumber(field),
                        in: sliderRange(for: field),
                        step: stepValue(for: field)
                    )
                    .tint(S2.MyDay.Colors.interactiveTint)
                }
                .s2MyDayInputSurface()

            case .toggle:
                Toggle(isOn: bindingForToggle(fieldId: field.id)) {
                    Text(field.placeholder ?? "Enabled")
                        .font(S2.MyDay.Typography.fieldValue)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                }
                .tint(S2.MyDay.Colors.interactiveTint)
                .s2MyDayInputSurface()

            case .rating:
                ratingEditor(for: field)
            }
        }
    }

    private func ratingEditor(for field: CustomFieldDef) -> some View {
        let numericBinding = bindingForNumber(field)
        let range = sliderRange(for: field)
        let maxStars = max(1, Int(range.upperBound.rounded(.down)))
        let selected = Int(numericBinding.wrappedValue.rounded())

        return HStack(spacing: S2.Spacing.sm) {
            ForEach(1...maxStars, id: \.self) { index in
                Button {
                    numericBinding.wrappedValue = Double(index)
                } label: {
                    Image(systemName: index <= selected ? "star.fill" : "star")
                        .font(.system(size: S2.MyDay.Icon.ratingSize))
                        .foregroundColor(index <= selected ? S2.MyDay.Colors.ratingFilled : S2.MyDay.Colors.ratingEmpty)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .s2MyDayInputSurface()
    }

    private func multilineEditor(for field: CustomFieldDef) -> some View {
        let textBinding = bindingForText(fieldId: field.id)

        return ZStack(alignment: .topLeading) {
            if textBinding.wrappedValue.isEmpty {
                Text(field.placeholder ?? "Start writing…")
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.placeholderText)
                    .padding(.horizontal, S2.Spacing.xs)
                    .padding(.vertical, S2.Spacing.sm)
            }

            TextEditor(text: textBinding)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(S2.MyDay.Colors.titleText)
                .frame(minHeight: 90)
                .padding(S2.Spacing.xs)
                .background(Color.clear)
                .scrollContentBackground(.hidden)
        }
        .s2MyDayInputSurface(padding: S2.MyDay.Spacing.inputInset)
    }

    private func bindingForText(fieldId: String) -> Binding<String> {
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

    private func bindingForToggle(fieldId: String) -> Binding<Bool> {
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

    private func bindingForNumber(_ field: CustomFieldDef) -> Binding<Double> {
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

    private func value(for fieldId: String) -> CustomFieldValue {
        if let current = block.customData?.first(where: { $0.id == fieldId }) {
            return current
        }
        if let field = typeDef.fields.first(where: { $0.id == fieldId }) {
            return defaultValue(for: field)
        }
        return CustomFieldValue(id: fieldId, textValue: nil, numberValue: nil, boolValue: nil)
    }

    private func mutateValue(for fieldId: String, transform: (inout CustomFieldValue) -> Void) {
        var values = block.customData ?? []
        if let index = values.firstIndex(where: { $0.id == fieldId }) {
            transform(&values[index])
        } else if let field = typeDef.fields.first(where: { $0.id == fieldId }) {
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

    private func hydrateMissingValues() {
        let current = block.customData ?? []
        let currentMap = Dictionary(uniqueKeysWithValues: current.map { ($0.id, $0) })
        let hydrated = typeDef.fields.map { field in
            currentMap[field.id] ?? defaultValue(for: field)
        }

        if block.customData != hydrated {
            block.customData = hydrated
        }
    }

    private func defaultValue(for field: CustomFieldDef) -> CustomFieldValue {
        switch field.type {
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

    private func defaultNumericValue(for field: CustomFieldDef) -> Double {
        if let min = field.min {
            return min
        }
        switch field.type {
        case .rating:
            return 1
        default:
            return 0
        }
    }

    private func clamped(_ value: Double, for field: CustomFieldDef) -> Double {
        var nextValue = value
        if let min = field.min {
            nextValue = max(nextValue, min)
        } else if field.type == .rating {
            nextValue = max(nextValue, 1)
        }

        if let maxValue = field.max {
            nextValue = min(nextValue, maxValue)
        } else if field.type == .rating {
            nextValue = min(nextValue, 5)
        }

        if field.type == .rating {
            return nextValue.rounded()
        }
        return nextValue
    }

    private func sliderRange(for field: CustomFieldDef) -> ClosedRange<Double> {
        let lowerBound = field.min ?? 0
        let fallbackUpper: Double = field.type == .rating ? 5 : 10
        let upperBound = max(lowerBound, field.max ?? fallbackUpper)
        return lowerBound...upperBound
    }

    private func stepValue(for field: CustomFieldDef) -> Double {
        if let step = field.step, step > 0 {
            return step
        }
        if field.type == .rating {
            return 1
        }
        return 1
    }
}
