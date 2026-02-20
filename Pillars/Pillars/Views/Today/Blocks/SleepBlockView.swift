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
        VStack(spacing: S2.MyDay.Spacing.contentStack) {
            VStack(spacing: S2.Spacing.sm) {
                HStack {
                    S2MyDayFieldLabel(text: "Duration")
                    Spacer()
                    Text(durationLabel)
                        .font(S2.MyDay.Typography.valueStrong)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                }

                HStack(spacing: S2.Spacing.lg) {
                    stepButton(systemName: "minus.circle.fill", isEnabled: data.durationHours > 0) {
                        data.durationHours = max(0, data.durationHours - 0.5)
                    }

                    Slider(value: $data.durationHours, in: 0...12, step: 0.5)
                        .tint(S2.MyDay.Colors.interactiveTint)

                    stepButton(systemName: "plus.circle.fill", isEnabled: data.durationHours < 12) {
                        data.durationHours = min(12, data.durationHours + 0.5)
                    }
                }
            }

            VStack(spacing: S2.Spacing.sm) {
                HStack {
                    S2MyDayFieldLabel(text: "Quality")
                    Spacer()
                    Text(qualityLabel)
                        .font(S2.MyDay.Typography.valueStrong)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                }

                HStack(spacing: S2.Spacing.sm) {
                    ForEach(1...5, id: \.self) { star in
                        Button {
                            data.quality = star
                        } label: {
                            Image(systemName: star <= data.quality ? "star.fill" : "star")
                                .font(.system(size: 24))
                                .foregroundColor(star <= data.quality ? S2.MyDay.Colors.ratingFilled : S2.MyDay.Colors.ratingEmpty)
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer()
                }
            }

            HStack(spacing: S2.Spacing.lg) {
                timeField(
                    title: "Bedtime",
                    placeholder: "e.g. 22:30",
                    text: Binding(
                        get: { data.bedtime ?? "" },
                        set: { data.bedtime = $0.isEmpty ? nil : $0 }
                    )
                )

                timeField(
                    title: "Wake time",
                    placeholder: "e.g. 07:00",
                    text: Binding(
                        get: { data.wakeTime ?? "" },
                        set: { data.wakeTime = $0.isEmpty ? nil : $0 }
                    )
                )
            }
        }
    }

    private func stepButton(systemName: String, isEnabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: S2.MyDay.Icon.stepperSize))
                .foregroundColor(isEnabled ? S2.MyDay.Colors.interactiveTint : S2.MyDay.Colors.disabledIcon)
        }
        .buttonStyle(.plain)
    }

    private func timeField(title: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: S2.Spacing.xs) {
            S2MyDayFieldLabel(text: title)

            TextField(placeholder, text: text)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(S2.MyDay.Colors.titleText)
                .keyboardType(.numbersAndPunctuation)
                .s2MyDayInputSurface()
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
