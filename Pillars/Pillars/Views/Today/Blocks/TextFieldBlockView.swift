//
//  TextFieldBlockView.swift
//  Pillars
//
//  Generic block view for labeled text fields (workout, event)
//

import SwiftUI

struct TextFieldBlockView: View {
    @Binding var data: TextFieldData

    var body: some View {
        VStack(spacing: S2.MyDay.Spacing.contentStack) {
            ForEach($data.fields) { $field in
                VStack(alignment: .leading, spacing: S2.MyDay.Spacing.fieldStack) {
                    S2MyDayFieldLabel(text: field.label)

                    if field.isMultiline {
                        multilineField(text: $field.value)
                    } else {
                        TextField(field.label, text: $field.value)
                            .font(S2.MyDay.Typography.fieldValue)
                            .foregroundColor(S2.MyDay.Colors.titleText)
                            .s2MyDayInputSurface()
                    }
                }
            }
        }
    }

    private func multilineField(text: Binding<String>) -> some View {
        ZStack(alignment: .topLeading) {
            if text.wrappedValue.isEmpty {
                Text("Add notes…")
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.placeholderText)
                    .padding(.horizontal, S2.Spacing.xs)
                    .padding(.vertical, S2.Spacing.sm)
            }

            TextEditor(text: text)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(S2.MyDay.Colors.titleText)
                .frame(minHeight: 70)
                .padding(S2.Spacing.xs)
                .background(Color.clear)
                .scrollContentBackground(.hidden)
        }
        .s2MyDayInputSurface(padding: S2.MyDay.Spacing.inputInset)
    }
}
