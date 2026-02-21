import SwiftUI

struct PointsContentView: View {
    let pillar: Pillar
    @StateObject private var viewModel = PillarPointsViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    private var totalPoints: Int {
        pillar.stats.pointTotal > 0 ? pillar.stats.pointTotal : viewModel.pointsForPillar(pillar.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.md) {
            summaryCard

            if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, S2.Spacing.xl)
            } else if viewModel.events.isEmpty {
                ContentEmptyState(
                    icon: "sparkles",
                    title: "No points yet",
                    description: "Log a todo or habit with points to see them here."
                )
            } else {
                LazyVStack(spacing: S2.Spacing.sm) {
                    ForEach(viewModel.events) { event in
                        PointEventRow(event: event, pillarId: pillar.id, accent: pillar.colorValue)
                    }
                }
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
        .padding(.bottom, S2.Spacing.lg)
        .task(id: firebaseManager.currentUser?.uid) {
            guard firebaseManager.currentUser != nil else { return }
            await viewModel.load(pillarId: pillar.id)
        }
    }

    private var summaryCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Total Points")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(S2.Colors.secondaryText)
                Text("\(totalPoints)")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(pillar.colorValue)
            }
            Spacer()
            if viewModel.events.isEmpty == false {
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Events")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(S2.Colors.secondaryText)
                    Text("\(viewModel.events.count)")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(S2.Colors.primaryText)
                }
            }
        }
        .padding(.horizontal, S2.Spacing.lg)
        .padding(.vertical, S2.Spacing.md)
        .background(S2.Colors.elevated)
        .cornerRadius(S2.CornerRadius.lg)
        .shadow(
            color: S2.Shadow.md.color,
            radius: S2.Shadow.md.radius,
            x: S2.Shadow.md.x,
            y: S2.Shadow.md.y
        )
    }
}

private struct PointEventRow: View {
    let event: PointEvent
    let pillarId: String
    let accent: Color

    private var points: Int {
        event.points(for: pillarId)
    }

    private var dateString: String {
        if let date = event.dateValue {
            return Self.displayFormatter.string(from: date)
        }
        return event.date
    }

    var body: some View {
        HStack(alignment: .center, spacing: S2.Spacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text(event.reason)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(S2.Colors.primaryText)
                    .lineLimit(2)
                Text(dateString)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(S2.Colors.secondaryText)
            }
            Spacer()
            Text("+\(points)")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(accent)
                .padding(.horizontal, S2.Spacing.md)
                .padding(.vertical, S2.Spacing.xs)
                .background(accent.opacity(0.1))
                .cornerRadius(S2.CornerRadius.sm)
        }
        .padding(.horizontal, S2.Spacing.md)
        .padding(.vertical, S2.Spacing.sm)
        .background(S2.Colors.elevated)
        .cornerRadius(S2.CornerRadius.md)
        .shadow(
            color: S2.Shadow.sm.color,
            radius: S2.Shadow.sm.radius,
            x: S2.Shadow.sm.x,
            y: S2.Shadow.sm.y
        )
    }

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter
    }()
}

#Preview {
    PointsContentView(
        pillar: Pillar(
            id: "pillar1",
            userId: "u1",
            name: "Marriage",
            color: "#ff6600",
            icon: .heart,
            stats: Pillar.PillarStats(pointEventCount: 2, pointTotal: 30)
        )
    )
    .environmentObject(FirebaseManager.shared)
}
