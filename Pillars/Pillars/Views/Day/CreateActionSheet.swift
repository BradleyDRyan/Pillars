//
//  CreateActionSheet.swift
//  Pillars
//
//  Dedicated sheet for creating a new action.
//

import SwiftUI

struct CreateActionSheet: View {
    let onCreate: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @FocusState private var isTitleFocused: Bool
    @State private var title = ""

    private var normalizedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canCreate: Bool {
        !normalizedTitle.isEmpty
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionGap) {
                fieldGroup("Title") {
                    TextField("What needs to happen?", text: $title)
                        .font(S2.MyDay.Typography.fieldValue)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                        .submitLabel(.done)
                        .focused($isTitleFocused)
                        .s2MyDayInputSurface()
                }

                Spacer()
            }
            .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
            .padding(.vertical, S2.MyDay.Spacing.pageVertical)
            .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
            .navigationTitle("Create Action")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        onCreate(normalizedTitle)
                        dismiss()
                    }
                    .disabled(!canCreate)
                    .foregroundColor(
                        canCreate
                            ? S2.MyDay.Colors.interactiveTint
                            : S2.MyDay.Colors.subtitleText
                    )
                }
            }
        }
        .onAppear {
            isTitleFocused = true
        }
    }

    @ViewBuilder
    private func fieldGroup<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.compact) {
            Text(title)
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            content()
        }
    }
}
