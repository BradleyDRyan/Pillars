//
//  ContextContentView.swift
//  Pillars
//
//  Pillar context markdown in Pillar detail.
//

import SwiftUI

struct ContextContentView: View {
    let pillar: Pillar
    @EnvironmentObject var viewModel: PillarsViewModel
    @State private var showingContextEditor = false
    @State private var contextDraftMarkdown = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var contextMarkdown: String {
        pillar.contextMarkdown?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private var hasContext: Bool {
        !contextMarkdown.isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            headerRow

            if hasContext {
                contextCard
            } else {
                ContentEmptyState(
                    icon: "text.alignleft",
                    title: "No context yet",
                    description: "Add context so AI has better personal signal for this pillar."
                )
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(S2.TextStyle.footnote)
                    .foregroundColor(S2.Colors.error)
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
        .padding(.bottom, S2.Spacing.lg)
        .sheet(isPresented: $showingContextEditor) {
            contextEditorSheet
        }
    }

    private var headerRow: some View {
        HStack(spacing: S2.Spacing.sm) {
            VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                Text("Context")
                    .font(S2.TextStyle.headline)
                    .foregroundColor(S2.Colors.primaryText)

                Text("Markdown context used to personalize suggestions and classification.")
                    .font(S2.TextStyle.subheadline)
                    .foregroundColor(S2.Colors.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: S2.Spacing.sm)

            S2Button(
                title: hasContext ? "Edit" : "Add",
                icon: hasContext ? "pencil" : "plus",
                variant: .secondary,
                size: .small,
                fullWidth: false
            ) {
                contextDraftMarkdown = contextMarkdown
                errorMessage = nil
                showingContextEditor = true
            }
        }
    }

    private var contextCard: some View {
        Text(contextMarkdown)
            .font(S2.TextStyle.body)
            .foregroundColor(S2.Colors.primaryText)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, S2.Spacing.md)
            .padding(.vertical, S2.Spacing.md)
            .background(S2.Colors.elevated)
            .cornerRadius(S2.CornerRadius.lg)
    }

    private var contextEditorSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: S2.Spacing.sm) {
                Text("Write personal context in markdown bullets.")
                    .font(S2.TextStyle.subheadline)
                    .foregroundColor(S2.Colors.secondaryText)

                ZStack(alignment: .topLeading) {
                    TextEditor(text: $contextDraftMarkdown)
                        .font(S2.TextStyle.body)
                        .foregroundColor(S2.Colors.primaryText)
                        .frame(minHeight: 240)
                        .textInputAutocapitalization(.sentences)

                    if contextDraftMarkdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text("- Emme is Bradley's wife\n- Quality time and acts of service matter in this pillar")
                            .font(S2.TextStyle.body)
                            .foregroundColor(S2.Colors.tertiaryText)
                            .padding(.horizontal, S2.Spacing.xs)
                            .padding(.vertical, S2.Spacing.sm)
                    }
                }
                .padding(.horizontal, S2.Spacing.xs)
                .padding(.vertical, S2.Spacing.xs)
                .background(S2.Colors.secondarySurface)
                .cornerRadius(S2.CornerRadius.md)

                if isSaving {
                    ProgressView()
                        .controlSize(.small)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(S2.TextStyle.footnote)
                        .foregroundColor(S2.Colors.error)
                }

                Spacer()
            }
            .padding(.horizontal, S2.Spacing.lg)
            .padding(.top, S2.Spacing.md)
            .background(S2.Colors.surface.ignoresSafeArea())
            .navigationTitle("Edit Context")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingContextEditor = false
                    }
                    .disabled(isSaving)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await saveContextMarkdown()
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func saveContextMarkdown() async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            try await viewModel.updatePillar(
                pillar,
                contextMarkdown: contextDraftMarkdown,
                updateContextMarkdown: true
            )
            showingContextEditor = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    ContextContentView(
        pillar: Pillar(
            id: "preview",
            userId: "user",
            name: "Marriage",
            description: "Relationship with Emme",
            color: "#E91E63",
            icon: .heart,
            contextMarkdown: "- Emme is Bradley's wife\n- Date nights matter"
        )
    )
    .environmentObject(PillarsViewModel())
}
