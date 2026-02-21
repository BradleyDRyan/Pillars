//
//  CustomBlockView.swift
//  Pillars
//
//  Main wrapper for API-defined custom block forms.
//  This file keeps only the high-level render loop.
//

import SwiftUI

struct CustomBlockView: View {
    @Binding var block: Block
    let typeDef: BlockType

    var body: some View {
        VStack(spacing: S2.MyDay.Spacing.contentStack) {
            ForEach(typeDef.dataSchema.fields) { field in
                fieldEditor(for: field)
            }
        }
        .onAppear(perform: hydrateMissingValues)
    }
}
