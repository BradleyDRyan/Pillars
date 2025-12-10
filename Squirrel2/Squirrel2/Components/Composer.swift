//
//  Composer.swift
//  Squirrel2
//
//  Unified composer component - iOS 26 Liquid Glass style
//

import SwiftUI

struct Composer: View {
    let placeholder: String
    @Binding var text: String
    var isLoading: Bool = false
    let onSend: () -> Void
    var onVoice: (() -> Void)? = nil
    var onAttach: (() -> Void)? = nil
    
    private let inputHeight: CGFloat = 48
    
    var body: some View {
        HStack(spacing: 10) {
            // Plus/Attach button - using composer variant for matched height
            IconButton(icon: "plus", isSystemIcon: true, variant: .composer, action: { onAttach?() })
            
            // Text field container with glass effect
            HStack(spacing: 8) {
                TextField(placeholder, text: $text)
                    .font(.squirrelChatInput)
                    .onSubmit(onSend)
                
                // Mic button (only if voice handler provided)
                if let onVoice = onVoice {
                    Button(action: onVoice) {
                        Image("mic")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 28, height: 28)
                            .padding(2)  // 28 + 2*2 = 32x32
                    }
                    .buttonStyle(.plain)
                }
                
                // Send/Waveform button
                Button(action: {
                    if text.isEmpty {
                        onVoice?()
                    } else {
                        onSend()
                    }
                }) {
                    Group {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.7)
                        } else if text.isEmpty {
                            Image("waves")
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 28, height: 28)
                                .padding(2)  // 28 + 2*2 = 32x32
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 16, weight: .semibold))
                        }
                    }
                    .foregroundColor(.white)
                    .frame(width: 34, height: 34)
                    .background(
                        Circle()
                            .fill(Color.black)
                    )
                }
                .buttonStyle(.plain)
                .disabled(isLoading || (text.isEmpty && onVoice == nil))
            }
            .padding(.leading, 16)
            .padding(.trailing, 7)
            .frame(height: inputHeight)
            .glassEffect(.regular.interactive(), in: .capsule)
            .glassShadow()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        // safeAreaBar handles bottom safe area when used in ConversationView
    }
}

#Preview {
    VStack {
        Spacer()
        Composer(
            placeholder: "Ask about Health",
            text: .constant(""),
            onSend: {}
        )
    }
    .background(Color.gray.opacity(0.1))
}


