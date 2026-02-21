//
//  CustomBlockView+Editors.swift
//  Pillars
//
//  Field-level UI for custom blocks.
//  In plain terms: how each custom field is shown to the user.
//

import SwiftUI

extension CustomBlockView {
    @ViewBuilder
    func fieldEditor(for field: BlockTypeFieldSchema) -> some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.fieldStack) {
            S2MyDayFieldLabel(text: field.label)

            switch field.fieldKind {
            case .text:
                TextField(field.label, text: bindingForText(fieldId: field.id))
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .s2MyDayInputSurface()

            case .multiline:
                multilineEditor(for: field)

            case .number:
                TextField(field.label, value: bindingForNumber(field), format: .number)
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
                    Text(field.label)
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

    func ratingEditor(for field: BlockTypeFieldSchema) -> some View {
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

    func multilineEditor(for field: BlockTypeFieldSchema) -> some View {
        let textBinding = bindingForText(fieldId: field.id)

        return ZStack(alignment: .topLeading) {
            if textBinding.wrappedValue.isEmpty {
                Text("Start writing...")
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
}
