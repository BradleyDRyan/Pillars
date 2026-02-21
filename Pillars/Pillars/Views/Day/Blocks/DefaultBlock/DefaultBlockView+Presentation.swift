//
//  DefaultBlockView+Presentation.swift
//  Pillars
//
//  Row presentation for standard Day blocks.
//  This file decides title, icon, trailing text, and visual row layout.
//

import SwiftUI
import UIKit

extension DefaultBlockView {
    // Looks up an API-defined custom type when this row is custom.
    var customType: BlockType? {
        customTypes.first(where: { $0.id == block.typeId })
    }

    // For todos, the first checklist item is used as the row title.
    var todoPrimaryTitle: String? {
        guard block.typeId == "todo" else { return nil }
        guard let items = block.checklistData?.items else { return nil }
        return items.compactMap { nonEmpty($0.title) }.first
    }

    var title: String {
        if let todoPrimaryTitle {
            return todoPrimaryTitle
        }
        if let builtIn = block.blockType {
            return builtIn.name
        }
        if let customType {
            return customType.name
        }
        return block.displayTitle
    }

    var rowTitle: String {
        titleOverride ?? title
    }

    var expandedDescription: String {
        if let builtIn = block.blockType {
            return builtIn.description
        }
        if let customType {
            return customType.description
        }
        return "This block type no longer exists."
    }

    var icon: String {
        if let customType {
            return customType.icon
        }
        return block.displayIcon
    }

    var collapsedTrailingValue: String? {
        if let builtIn = block.blockType {
            return builtInCollapsedValue(for: builtIn)
        }
        if let customType {
            return customCollapsedValue(for: customType)
        }
        return nil
    }

    var rowTrailingValue: String? {
        if let trailingOverride {
            let trimmed = trailingOverride.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        return collapsedTrailingValue
    }

    var standardRow: some View {
        CoreCardRow(
            leading: {
                if showLeadingAccessory {
                    iconView(leadingIconName ?? icon)
                        .frame(width: CGFloat(cardStyle.leadingAccessorySize), height: CGFloat(cardStyle.leadingAccessorySize))
                } else {
                    EmptyView()
                }
            },
            title: {
                Text(rowTitle)
                    .font(S2.MyDay.Typography.blockTitle)
                    .foregroundColor(isChecked ? S2.MyDay.Colors.subtitleText : S2.MyDay.Colors.titleText)
                    .strikethrough(isChecked, color: S2.MyDay.Colors.subtitleText)
                    .multilineTextAlignment(.leading)
                    .lineLimit(1)
            },
            subtitle: {
                if isCheckable, let pillarTag {
                    pillarChip(pillarTag)
                }
            },
            trailing: {
                HStack(spacing: S2.Spacing.xs) {
                    if !isCheckable, let rowTrailingValue {
                        Text(rowTrailingValue)
                            .font(S2.MyDay.Typography.valueStrong)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                            .frame(minWidth: 36, alignment: .trailing)
                    }

                    if isCheckable, let onCheckToggle {
                        S2MyDayDoneIconButton(
                            isCompleted: isChecked,
                            size: .compact,
                            completedIconName: doneCompletedIconName,
                            incompleteIconName: doneIncompleteIconName,
                            action: onCheckToggle
                        )
                    }
                }
            }
        )
    }

    var compactCompletedTodoRow: some View {
        CoreCardRow(
            leading: {
                if showLeadingAccessory {
                    iconView(leadingIconName ?? icon)
                        .frame(width: CGFloat(cardStyle.leadingAccessorySize), height: CGFloat(cardStyle.leadingAccessorySize))
                } else {
                    EmptyView()
                }
            },
            title: {
                Text(rowTitle)
                    .font(S2.MyDay.Typography.blockTitle)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                    .multilineTextAlignment(.leading)
                    .lineLimit(1)
            },
            trailing: {
                HStack(spacing: S2.Spacing.xs) {
                    if let compactCompletedTrailingText {
                        compactPointsPill(text: compactCompletedTrailingText)
                    }
                }
            }
        )
    }

    @ViewBuilder
    func compactPointsPill(text: String) -> some View {
        HStack(spacing: S2.Spacing.xxs) {
            Image(systemName: "checkmark")
                .font(.system(size: 10, weight: .bold))
            Text(text)
                .font(S2.MyDay.Typography.caption2)
                .fontWeight(.semibold)
        }
        .foregroundColor(S2.MyDay.Colors.titleText)
        .padding(.horizontal, S2.Spacing.xs)
        .padding(.vertical, S2.Spacing.xxs)
        .background(S2.MyDay.Colors.sectionBackground)
        .clipShape(Capsule())
    }

    @ViewBuilder
    func iconView(_ icon: String) -> some View {
        let resolvedIcon = BlockIcon.resolvedSystemSymbol(from: icon)

        if UIImage(systemName: resolvedIcon) != nil {
            Image(systemName: resolvedIcon)
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(S2.MyDay.Colors.rowIconTint)
                .font(.system(size: CGFloat(cardStyle.leadingIconSize), weight: .semibold))
        } else {
            Text(resolvedIcon)
                .font(.system(size: CGFloat(cardStyle.leadingIconSize)))
        }
    }

    @ViewBuilder
    func pillarChip(_ pillarTag: BlockPillarTagDisplay) -> some View {
        if let onPillarTap {
            Button(action: onPillarTap) {
                PillarTagChip(title: pillarTag.title, color: pillarTag.color)
            }
            .buttonStyle(.plain)
        } else {
            PillarTagChip(title: pillarTag.title, color: pillarTag.color)
        }
    }
}
