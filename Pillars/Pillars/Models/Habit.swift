//
//  Habit.swift
//  Pillars
//
//  Habit model used by the Habits feature list.
//

import Foundation

struct Habit: Identifiable {
    let blockId: String
    let section: DaySection.TimeSection
    let habitId: String
    let pillarId: String?
    let block: Block
    let item: ChecklistItem
    let itemIndex: Int

    var id: String { "\(blockId):\(item.id)" }
}
