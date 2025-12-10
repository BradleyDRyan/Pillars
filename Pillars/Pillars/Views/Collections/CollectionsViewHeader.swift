//
//  CollectionsViewHeader.swift
//  Squirrel2
//
//  Header component for collections view with title
//

import SwiftUI

struct CollectionsViewHeader: View {
    var body: some View {
        HStack {
            S2.Typography.title1("Collections")
                .foregroundColor(S2.Colors.primaryText)

            Spacer()
        }
        .padding(S2.Spacing.lg)
    }
}