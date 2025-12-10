//
//  PhotosViewHeader.swift
//  Squirrel2
//
//  Header component for photos view with title
//

import SwiftUI

struct PhotosViewHeader: View {
    var body: some View {
        HStack {
            S2.Typography.title1("Photos")
                .foregroundColor(S2.Colors.primaryText)

            Spacer()
        }
        .padding(S2.Spacing.lg)
    }
}