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
        VStack(spacing: 16) {
            ForEach($data.sliders) { $slider in
                VStack(spacing: 6) {
                    HStack {
                        Text(slider.label)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(String(format: "%.0f", slider.value))
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.primary)
                            .frame(width: 24, alignment: .trailing)
                    }
                    HStack(spacing: 8) {
                        Text("0")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                        Slider(value: $slider.value, in: 0...10, step: 0.5)
                            .tint(.accentColor)
                        Text("10")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
}
