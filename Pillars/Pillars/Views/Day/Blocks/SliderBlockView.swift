//
//  SliderBlockView.swift
//  Pillars
//
//  Generic block view for 0–10 labeled sliders
//

import SwiftUI

struct SliderBlockView: View {
    @Binding var data: SliderData

    var body: some View {
        VStack(spacing: S2.Spacing.lg) {
            ForEach($data.sliders) { $slider in
                VStack(spacing: S2.MyDay.Spacing.fieldStack) {
                    HStack {
                        S2MyDayFieldLabel(text: slider.label)

                        Spacer()

                        Text(String(format: "%.0f", slider.value))
                            .font(S2.MyDay.Typography.valueStrong)
                            .foregroundColor(S2.MyDay.Colors.titleText)
                            .frame(width: 24, alignment: .trailing)
                    }

                    HStack(spacing: S2.Spacing.sm) {
                        Text("0")
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)

                        Slider(value: $slider.value, in: 0...10, step: 0.5)
                            .tint(S2.MyDay.Colors.interactiveTint)

                        Text("10")
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                }
            }
        }
    }
}
