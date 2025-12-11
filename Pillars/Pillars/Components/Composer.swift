//
//  Composer.swift
//  Pillars
//
//  Text input composer component for starting conversations
//

import SwiftUI

struct Composer: View {
    let placeholder: String
    @Binding var text: String
    let onSend: () -> Void
    let onVoice: () -> Void
    
    @FocusState private var isFocused: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            // Voice button
            Button(action: onVoice) {
                Image(systemName: "mic.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.secondary)
            }
            .frame(width: 36, height: 36)
            
            // Text field
            TextField(placeholder, text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .focused($isFocused)
                .submitLabel(.send)
                .onSubmit {
                    if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        onSend()
                    }
                }
            
            // Send button
            Button(action: onSend) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 28))
                    .foregroundColor(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .secondary : .accentColor)
            }
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 24)
                .fill(Color(UIColor.secondarySystemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(Color(UIColor.separator), lineWidth: 0.5)
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}

#Preview {
    VStack {
        Spacer()
        Composer(
            placeholder: "Ask anything...",
            text: .constant(""),
            onSend: { print("Send") },
            onVoice: { print("Voice") }
        )
    }
    .background(Color(UIColor.systemBackground))
}
