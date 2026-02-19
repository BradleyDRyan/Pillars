//
//  SleepBlockView.swift
//  Pillars
//
//  Bespoke block view for sleep data
//

import SwiftUI

struct SleepBlockView: View {
    @Binding var data: SleepData

    var body: some View {
        VStack(spacing: 20) {
            // Duration
            VStack(spacing: 8) {
                HStack {
                    Text("Duration")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(durationLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.primary)
                }
                HStack(spacing: 16) {
                    Button {
                        if data.durationHours > 0 {
                            data.durationHours = max(0, data.durationHours - 0.5)
                        }
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(data.durationHours > 0 ? .accentColor : .secondary.opacity(0.4))
                    }
                    Slider(value: $data.durationHours, in: 0...12, step: 0.5)
                        .tint(.accentColor)
                    Button {
                        if data.durationHours < 12 {
                            data.durationHours = min(12, data.durationHours + 0.5)
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(data.durationHours < 12 ? .accentColor : .secondary.opacity(0.4))
                    }
                }
            }

            // Quality
            VStack(spacing: 8) {
                HStack {
                    Text("Quality")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(qualityLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.primary)
                }
                HStack(spacing: 8) {
                    ForEach(1...5, id: \.self) { star in
                        Button {
                            data.quality = star
                        } label: {
                            Image(systemName: star <= data.quality ? "star.fill" : "star")
                                .font(.system(size: 24))
                                .foregroundColor(star <= data.quality ? .yellow : .secondary.opacity(0.4))
                        }
                    }
                    Spacer()
                }
            }

            // Times
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Bedtime")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                    TextField("e.g. 22:30", text: Binding(
                        get: { data.bedtime ?? "" },
                        set: { data.bedtime = $0.isEmpty ? nil : $0 }
                    ))
                    .font(.system(size: 15))
                    .keyboardType(.numbersAndPunctuation)
                    .padding(10)
                    .background(Color(UIColor.tertiarySystemBackground))
                    .cornerRadius(8)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("Wake time")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                    TextField("e.g. 07:00", text: Binding(
                        get: { data.wakeTime ?? "" },
                        set: { data.wakeTime = $0.isEmpty ? nil : $0 }
                    ))
                    .font(.system(size: 15))
                    .keyboardType(.numbersAndPunctuation)
                    .padding(10)
                    .background(Color(UIColor.tertiarySystemBackground))
                    .cornerRadius(8)
                }
            }
        }
    }

    private var durationLabel: String {
        let hours = Int(data.durationHours)
        let minutes = Int((data.durationHours - Double(hours)) * 60)
        if minutes == 0 {
            return "\(hours)h"
        } else {
            return "\(hours)h \(minutes)m"
        }
    }

    private var qualityLabel: String {
        switch data.quality {
        case 1: return "Poor"
        case 2: return "Fair"
        case 3: return "Good"
        case 4: return "Great"
        case 5: return "Excellent"
        default: return ""
        }
    }
}
