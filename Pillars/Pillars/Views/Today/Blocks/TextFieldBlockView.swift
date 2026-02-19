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
        VStack(spacing: 14) {
            ForEach($data.fields) { $field in
                VStack(alignment: .leading, spacing: 6) {
                    Text(field.label)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                    if field.isMultiline {
                        ZStack(alignment: .topLeading) {
                            if field.value.isEmpty {
                                Text("Add notes…")
                                    .font(.system(size: 15))
                                    .foregroundColor(.secondary.opacity(0.6))
                                    .padding(.horizontal, 4)
                                    .padding(.vertical, 8)
                            }
                            TextEditor(text: $field.value)
                                .font(.system(size: 15))
                                .frame(minHeight: 70)
                                .padding(4)
                                .background(Color.clear)
                                .scrollContentBackground(.hidden)
                        }
                        .padding(6)
                        .background(Color(UIColor.tertiarySystemBackground))
                        .cornerRadius(8)
                    } else {
                        TextField(field.label, text: $field.value)
                            .font(.system(size: 15))
                            .padding(10)
                            .background(Color(UIColor.tertiarySystemBackground))
                            .cornerRadius(8)
                    }
                }
            }
        }
    }
}
