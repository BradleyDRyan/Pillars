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
                    .font(.system(size: 15))
                    .foregroundColor(.secondary.opacity(0.6))
                    .padding(.horizontal, 4)
                    .padding(.vertical, 8)
            }
            TextEditor(text: $text)
                .font(.system(size: 15))
                .frame(minHeight: 100)
                .padding(4)
                .background(Color.clear)
                .scrollContentBackground(.hidden)
        }
        .padding(6)
        .background(Color(UIColor.tertiarySystemBackground))
        .cornerRadius(8)
    }
}
