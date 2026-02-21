//
//  FreeTextBlockView.swift
//  Pillars
//
//  Generic full-width TextEditor block for freeform text
//

import SwiftUI

struct FreeTextBlockView: View {
    @Binding var text: String

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text("Start writing…")
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.placeholderText)
                    .padding(.horizontal, S2.Spacing.xs)
                    .padding(.vertical, S2.Spacing.sm)
            }

            TextEditor(text: $text)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(S2.MyDay.Colors.titleText)
                .frame(minHeight: 100)
                .padding(S2.Spacing.xs)
                .background(Color.clear)
                .scrollContentBackground(.hidden)
        }
        .s2MyDayInputSurface(padding: S2.MyDay.Spacing.inputInset)
    }
}
