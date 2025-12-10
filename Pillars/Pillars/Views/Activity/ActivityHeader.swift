//
//  ActivityHeader.swift
//  Squirrel2
//
//  Header component for activity view with title
//

import SwiftUI

struct ActivityHeader: View {
    var body: some View {
        HStack {
            S2.Typography.title1("Activity")
                .foregroundColor(S2.Colors.primaryText)

            Spacer()
        }
        .padding(S2.Spacing.lg)
    }
}