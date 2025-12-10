//
//  ToolCallView.swift
//  Squirrel2
//
//  Simple tool call status UI for file reading operations
//

import SwiftUI

struct ToolCallView: View {
    let toolCall: ConversationViewModel.ToolCallState
    
    var body: some View {
        HStack(spacing: 12) {
            if toolCall.status == "calling" || toolCall.status == "reading" {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.primary)
                    .controlSize(.regular)
            } else {
                Image(systemName: toolIconName)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(iconColor)
            }
            
            Text(statusText)
                .font(.squirrelSubheadlineMedium)
                .foregroundColor(.primary)
                .lineLimit(1)
                .truncationMode(.tail)
            
            Spacer()
        }
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, minHeight: 48, maxHeight: 48, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.black.opacity(0.05), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.03), radius: 2, x: 0, y: 1)
        )
        .padding(.top, 12)
        .padding(.bottom, 12)
    }
    
    // MARK: - Computed Properties
    
    private var toolIconName: String {
        switch toolCall.name {
        case "read_file":
            return "text.page.badge.magnifyingglass"
        case "web_search":
            return "magnifyingglass.circle"
        case "browse_url":
            return "globe"
        default:
            return "gearshape"
        }
    }
    
    private var iconColor: Color {
        return .primary
    }
    
    private var statusText: String {
        guard toolCall.name == "read_file" else {
            return toolCall.status == "calling" ? "Running tool..." : "Tool completed"
        }
        
        switch toolCall.status {
        case "calling", "reading":
            if let title = toolCall.title {
                return "Reading \"\(title)\"..."
            }
            return "Reading document..."
        case "complete":
            if let title = toolCall.title {
                return "Read \"\(title)\""
            }
            return "Document read"
        case "error":
            return "Failed to read document"
        default:
            return "Processing..."
        }
    }
    
    private var subtitleText: String? {
        guard toolCall.name == "read_file" else { return nil }
        
        if toolCall.status == "complete", let pageCount = toolCall.pageCount {
            return "\(pageCount) page\(pageCount == 1 ? "" : "s") extracted"
        }
        
        return nil
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        ToolCallView(toolCall: ConversationViewModel.ToolCallState(
            id: "1",
            name: "read_file",
            status: "reading",
            title: "report.pdf"
        ))
        
        ToolCallView(toolCall: ConversationViewModel.ToolCallState(
            id: "2",
            name: "read_file",
            status: "complete",
            title: "report.pdf",
            pageCount: 5
        ))
        
        ToolCallView(toolCall: ConversationViewModel.ToolCallState(
            id: "3",
            name: "read_file",
            status: "error",
            title: "broken.pdf"
        ))
    }
    .padding()
}

