//
//  ActivityList.swift
//  Squirrel2
//
//  List component for displaying grouped conversations by date
//

import SwiftUI

struct ActivityList: View {
    @ObservedObject var viewModel: ActivityViewModel
    let onConversationSelected: (Conversation) -> Void

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(Array(viewModel.groupedConversations.keys.sorted(by: >)), id: \.self) { dateKey in
                    conversationSection(for: dateKey)
                }
            }
            .padding(.vertical)
        }
    }

    @ViewBuilder
    private func conversationSection(for dateKey: String) -> some View {
        Section {
            ForEach(viewModel.groupedConversations[dateKey] ?? []) { conversation in
                Button(action: {
                    onConversationSelected(conversation)
                }) {
                    ActivityItem(conversation: conversation)
                }
                .buttonStyle(PlainButtonStyle())
            }
        } header: {
            sectionHeader(for: dateKey)
        }
    }

    @ViewBuilder
    private func sectionHeader(for dateKey: String) -> some View {
        HStack {
            Text(formatSectionHeader(dateKey))
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .textCase(.uppercase)
            Spacer()
        }
        .padding(.horizontal)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private func formatSectionHeader(_ dateKey: String) -> String {
        let calendar = Calendar.current
        let date = viewModel.dateFromKey(dateKey)

        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else if let daysAgo = calendar.dateComponents([.day], from: date, to: Date()).day, daysAgo < 7 {
            return date.formatted(.dateTime.weekday(.wide))
        } else {
            return date.formatted(.dateTime.month(.abbreviated).day())
        }
    }
}