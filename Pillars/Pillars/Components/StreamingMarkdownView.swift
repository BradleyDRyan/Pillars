//
//  StreamingMarkdownView.swift
//  Squirrel2
//
//  Optimized markdown view for streaming LLM responses
//

import SwiftUI
import MarkdownUI

/// A markdown view optimized for streaming content from LLMs
/// Handles incomplete markdown syntax gracefully and optimizes for frequent updates
struct StreamingMarkdownView: View {
    let content: String
    let isStreaming: Bool
    let role: MessageRole
    
    // Custom theme based on role
    private var theme: Theme {
        if role == .user {
            return .userMessage
        } else {
            return .assistantMessage
        }
    }
    
    var body: some View {
        Markdown(content)
            .markdownTheme(theme)
            .font(.squirrelChatMessage)
            .textSelection(.enabled)
    }
}

// MARK: - Custom Themes for Chat Messages
extension Theme {
    /// Theme for user messages (dark text on gray background)
    static let userMessage = Theme()
        .text {
            ForegroundColor(.black)
            FontSize(16)
        }
        .strong {
            FontWeight(.bold)
        }
        .emphasis {
            FontStyle(.italic)
        }
        .link {
            ForegroundColor(.blue)
            UnderlineStyle(.single)
        }
        .paragraph { configuration in
            configuration.label
                .markdownMargin(top: 8, bottom: 12)
        }
        .code {
            FontFamilyVariant(.monospaced)
            FontSize(.em(0.9))
            ForegroundColor(Color(hex: "D73A49"))
            BackgroundColor(Color(hex: "F6F8FA"))
        }
        .codeBlock { configuration in
            configuration.label
                .markdownTextStyle {
                    FontFamilyVariant(.monospaced)
                    FontSize(.em(0.85))
                    ForegroundColor(.black)
                }
                .padding(12)
                .background(Color(hex: "F6F8FA"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .listItem { configuration in
            configuration.label
                .markdownMargin(top: 8, bottom: 10)
        }
        .heading1 { configuration in
            configuration.label
                .markdownTextStyle {
                    FontSize(24)
                    FontWeight(.bold)
                }
                .markdownMargin(top: 24, bottom: 16)
        }
        .heading2 { configuration in
            configuration.label
                .markdownTextStyle {
                    FontSize(20)
                    FontWeight(.semibold)
                }
                .markdownMargin(top: 20, bottom: 12)
        }
        .heading3 { configuration in
            configuration.label
                .markdownTextStyle {
                    FontSize(18)
                    FontWeight(.semibold)
                }
                .markdownMargin(top: 16, bottom: 10)
        }
    
    /// Theme for assistant messages (dark text on light background)
    static let assistantMessage = Theme()
        .text {
            ForegroundColor(S2.Colors.primaryText)
            FontSize(16)
        }
        .strong {
            FontWeight(.bold)
        }
        .emphasis {
            FontStyle(.italic)
        }
        .link {
            ForegroundColor(S2.Colors.primaryBrand)
            UnderlineStyle(.single)
        }
        .paragraph { configuration in
            configuration.label
                .markdownMargin(top: 8, bottom: 12)
        }
        .code {
            FontFamilyVariant(.monospaced)
            FontSize(.em(0.9))
            ForegroundColor(Color(hex: "D73A49"))
            BackgroundColor(Color(hex: "F6F8FA"))
        }
        .codeBlock { configuration in
            ScrollView(.horizontal, showsIndicators: false) {
                configuration.label
                    .markdownTextStyle {
                        FontFamilyVariant(.monospaced)
                        FontSize(.em(0.85))
                        ForegroundColor(S2.Colors.primaryText)
                    }
            }
            .padding(12)
            .background(Color(hex: "F6F8FA"))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .blockquote { configuration in
            configuration.label
                .padding(.leading, 12)
                .padding(.vertical, 4)
                .background(S2.Colors.secondarySurface)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(S2.Colors.secondaryText.opacity(0.4))
                        .frame(width: 3)
                        .cornerRadius(2)
                }
                .markdownTextStyle {
                    ForegroundColor(S2.Colors.secondaryText)
                    FontStyle(.italic)
                }
        }
        .listItem { configuration in
            configuration.label
                .markdownMargin(top: 8, bottom: 10)
        }
        .heading1 { configuration in
            configuration.label
                .markdownTextStyle {
                    FontSize(24)
                    FontWeight(.bold)
                }
                .markdownMargin(top: 24, bottom: 16)
        }
        .heading2 { configuration in
            configuration.label
                .markdownTextStyle {
                    FontSize(20)
                    FontWeight(.semibold)
                }
                .markdownMargin(top: 20, bottom: 12)
        }
        .heading3 { configuration in
            configuration.label
                .markdownTextStyle {
                    FontSize(18)
                    FontWeight(.semibold)
                }
                .markdownMargin(top: 16, bottom: 10)
        }
}

// MARK: - Simple Markdown Text (for user messages where full rendering isn't needed)
struct SimpleMarkdownText: View {
    let content: String
    let foregroundColor: Color
    
    var body: some View {
        // Use native AttributedString for simple inline formatting
        // Falls back to plain text if markdown parsing fails
        if let attributed = try? AttributedString(markdown: content) {
            Text(attributed)
                .foregroundColor(foregroundColor)
        } else {
            Text(content)
                .foregroundColor(foregroundColor)
        }
    }
}

#Preview("Assistant Message") {
    VStack(alignment: .leading, spacing: 16) {
        StreamingMarkdownView(
            content: """
            Here's how to **sort an array** in Swift:
            
            ```swift
            let sorted = array.sorted()
            ```
            
            You can also use:
            - `sort()` for in-place sorting
            - Custom comparators with `sorted(by:)`
            
            > Pro tip: Use `lazy` for large collections!
            """,
            isStreaming: false,
            role: .assistant
        )
        .padding()
        .background(S2.Colors.secondarySurface)
        .cornerRadius(18)
    }
    .padding()
}

#Preview("User Message") {
    StreamingMarkdownView(
        content: "How do I **sort** an array in Swift?",
        isStreaming: false,
        role: .user
    )
    .padding()
    .background(S2.Colors.secondarySurface)
    .cornerRadius(18)
}


