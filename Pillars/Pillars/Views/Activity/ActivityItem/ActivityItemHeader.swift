//
//  ActivityItemHeader.swift
//  Squirrel2
//
//  Header component for ActivityItem displaying time and location
//

import SwiftUI

struct ActivityItemHeader: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 8) {
            // Time
            Label {
                Text(formatTime(conversation.updatedAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
            } icon: {
                Image(systemName: "clock")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            // Location (if available)
            if let location = extractLocation(from: conversation.metadata) {
                Text("•")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Label {
                    Text(location)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                } icon: {
                    Image(systemName: "location.fill")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
    }

    private func formatTime(_ date: Date) -> String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday, \(date.formatted(date: .omitted, time: .shortened))"
        } else if let daysAgo = calendar.dateComponents([.day], from: date, to: now).day, daysAgo < 7 {
            return date.formatted(.dateTime.weekday(.abbreviated).hour().minute())
        } else {
            return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
        }
    }

    private func extractLocation(from metadata: [String: String]?) -> String? {
        guard let metadata = metadata else { return nil }

        // Try to build a location string from metadata
        if let locality = metadata["locality"] {
            if let administrativeArea = metadata["administrativeArea"] {
                return "\(locality), \(administrativeArea)"
            }
            return locality
        } else if let country = metadata["country"] {
            return country
        }

        return nil
    }
}