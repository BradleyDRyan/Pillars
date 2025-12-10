//
//  ProjectFilterPills.swift
//  Squirrel2
//
//  Filter pills for Chats / Bookmarks / Files in project detail view
//

import SwiftUI

struct ProjectFilterPills: View {
    @Binding var selectedFilter: ProjectFilter
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(ProjectFilter.allCases, id: \.self) { filter in
                ProjectFilterPill(
                    title: filter.rawValue,
                    isSelected: selectedFilter == filter
                ) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedFilter = filter
                    }
                }
            }

            Spacer()
        }
        .frame(height: 36)
        .padding(.bottom, 16)
        .background(alignment: .top) {
            LinearGradient(
                stops: [
                    .init(color: .white, location: 0.0),   // 0% - solid white
                    .init(color: .white, location: 0.5),   // 50% - still solid white
                    .init(color: .white.opacity(0), location: 1.0) // 100% - transparent
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

// MARK: - Individual Filter Pill

struct ProjectFilterPill: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    @ViewBuilder
    var body: some View {
        if isSelected {
            Button(action: action) {
                Text(title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(S2.Colors.primaryText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .glassEffect(.regular.interactive(), in: .capsule)
                    .glassShadow()
            }
            .buttonStyle(PlainButtonStyle())
        } else {
            Button(action: action) {
                Text(title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(S2.Colors.secondaryText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        Capsule()
                            .fill(Color.white.opacity(0.5))
                    )
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
}

// MARK: - Segmented Control Alternative
struct ProjectFilterSegmentedControl: View {
    @Binding var selectedFilter: ProjectFilter
    
    var body: some View {
        Picker("Project filter", selection: $selectedFilter) {
            ForEach([ProjectFilter.chats, ProjectFilter.files], id: \.self) { filter in
                Text(filter.rawValue)
                    .tag(filter)
            }
        }
        .pickerStyle(.segmented)
        .controlSize(.regular) // valid ControlSize values: mini, small, regular, large
        .frame(height: 32)
        .padding(.bottom, 20)
        .background(alignment: .top) {
            LinearGradient(
                stops: [
                    .init(color: .white, location: 0.0),
                    .init(color: .white, location: 0.5),
                    .init(color: .white.opacity(0), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

#Preview {
    VStack {
        ProjectFilterPills(selectedFilter: .constant(.chats))
        ProjectFilterPills(selectedFilter: .constant(.bookmarks))
        ProjectFilterSegmentedControl(selectedFilter: .constant(.files))
    }
    .padding()
}

