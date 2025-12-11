//
//  CoachPreferencesView.swift
//  Pillars
//
//  Settings view for personalizing your AI coach
//

import SwiftUI

struct CoachPreferencesView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = CoachPreferencesViewModel()
    
    var body: some View {
        NavigationStack {
            Form {
                // Communication Section
                Section {
                    communicationStylePicker
                    tonePicker
                } header: {
                    Text("Communication Style")
                } footer: {
                    Text("How your coach talks to you")
                }
                
                // Check-in Section
                Section {
                    checkInFrequencyPicker
                    preferredTimePicker
                    proactiveToggle
                } header: {
                    Text("Check-ins")
                } footer: {
                    Text("When and how often your coach reaches out")
                }
                
                // Focus Areas Section
                Section {
                    focusAreasPicker
                } header: {
                    Text("Focus Areas")
                } footer: {
                    Text("What topics your coach prioritizes")
                }
                
                // Message Preferences Section
                Section {
                    messageLengthPicker
                    emojiToggle
                } header: {
                    Text("Message Style")
                }
                
                // Preview Section
                Section {
                    previewCard
                } header: {
                    Text("Preview")
                } footer: {
                    Text("How your coach will respond based on these settings")
                }
            }
            .navigationTitle("Coach Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task {
                            await viewModel.save()
                            dismiss()
                        }
                    }
                    .fontWeight(.semibold)
                    .disabled(viewModel.isSaving)
                }
            }
            .overlay {
                if viewModel.isSaving {
                    ProgressView()
                        .padding()
                        .background(.ultraThinMaterial)
                        .cornerRadius(12)
                }
            }
        }
    }
    
    // MARK: - Communication Style Picker
    private var communicationStylePicker: some View {
        Picker("Style", selection: $viewModel.preferences.communicationStyle) {
            ForEach(CommunicationStyle.allCases, id: \.self) { style in
                Label {
                    VStack(alignment: .leading) {
                        Text(style.rawValue)
                        Text(style.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                } icon: {
                    Image(systemName: style.icon)
                }
                .tag(style)
            }
        }
        .pickerStyle(.navigationLink)
    }
    
    // MARK: - Tone Picker
    private var tonePicker: some View {
        Picker("Tone", selection: $viewModel.preferences.tone) {
            ForEach(CoachingTone.allCases, id: \.self) { tone in
                Label(tone.rawValue, systemImage: tone.icon)
                    .tag(tone)
            }
        }
        .pickerStyle(.navigationLink)
    }
    
    // MARK: - Check-in Frequency Picker
    private var checkInFrequencyPicker: some View {
        Picker("Frequency", selection: $viewModel.preferences.checkInFrequency) {
            ForEach(CheckInFrequency.allCases, id: \.self) { frequency in
                Text(frequency.rawValue).tag(frequency)
            }
        }
        .pickerStyle(.navigationLink)
    }
    
    // MARK: - Preferred Time Picker
    private var preferredTimePicker: some View {
        Picker("Preferred Time", selection: $viewModel.preferences.preferredTime) {
            ForEach(PreferredTime.allCases, id: \.self) { time in
                Label(time.rawValue, systemImage: time.icon)
                    .tag(time)
            }
        }
        .pickerStyle(.navigationLink)
    }
    
    // MARK: - Proactive Toggle
    private var proactiveToggle: some View {
        Toggle(isOn: $viewModel.preferences.proactiveCheckIns) {
            VStack(alignment: .leading) {
                Text("Proactive Check-ins")
                Text("Coach can start conversations")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
    
    // MARK: - Focus Areas Picker
    private var focusAreasPicker: some View {
        NavigationLink {
            FocusAreasPickerView(selectedAreas: $viewModel.preferences.focusAreas)
        } label: {
            HStack {
                Text("Areas")
                Spacer()
                Text(viewModel.preferences.focusAreas.map { $0.rawValue }.joined(separator: ", "))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
        }
    }
    
    // MARK: - Message Length Picker
    private var messageLengthPicker: some View {
        Picker("Response Length", selection: $viewModel.preferences.messageLength) {
            ForEach(MessageLength.allCases, id: \.self) { length in
                VStack(alignment: .leading) {
                    Text(length.rawValue)
                    Text(length.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .tag(length)
            }
        }
        .pickerStyle(.navigationLink)
    }
    
    // MARK: - Emoji Toggle
    private var emojiToggle: some View {
        Toggle(isOn: $viewModel.preferences.useEmojis) {
            Text("Use Emojis")
        }
    }
    
    // MARK: - Preview Card
    private var previewCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Circle()
                    .fill(LinearGradient(colors: [.purple, .blue], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 36, height: 36)
                    .overlay {
                        Image(systemName: "sparkles")
                            .font(.system(size: 16))
                            .foregroundColor(.white)
                    }
                
                Text("Coach")
                    .font(.system(size: 15, weight: .semibold))
                
                Spacer()
            }
            
            Text(previewMessage)
                .font(.system(size: 15))
                .foregroundColor(.primary)
                .padding(12)
                .background(Color(UIColor.tertiarySystemBackground))
                .cornerRadius(12)
        }
        .padding(.vertical, 8)
    }
    
    private var previewMessage: String {
        let prefs = viewModel.preferences
        
        var message = ""
        
        switch prefs.communicationStyle {
        case .direct:
            message = "You missed your morning routine. "
        case .gentle:
            message = "Hey! I noticed you had a busy morning. "
        case .balanced:
            message = "Quick check-in on your morning routine. "
        }
        
        switch prefs.tone {
        case .motivational:
            message += "Tomorrow's a fresh start - let's crush it!"
        case .analytical:
            message += "Looking at your patterns, mornings after late nights are harder."
        case .supportive:
            message += "It's okay, consistency matters more than perfection."
        case .challenging:
            message += "What's one thing you can do differently tomorrow?"
        }
        
        if prefs.useEmojis {
            message += " 💪"
        }
        
        return message
    }
}

// MARK: - Focus Areas Picker View
struct FocusAreasPickerView: View {
    @Binding var selectedAreas: [FocusArea]
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        List {
            ForEach(FocusArea.allCases, id: \.self) { area in
                Button {
                    toggleArea(area)
                } label: {
                    HStack {
                        Image(systemName: area.icon)
                            .foregroundColor(.accentColor)
                            .frame(width: 28)
                        
                        Text(area.rawValue)
                            .foregroundColor(.primary)
                        
                        Spacer()
                        
                        if selectedAreas.contains(area) {
                            Image(systemName: "checkmark")
                                .foregroundColor(.accentColor)
                        }
                    }
                }
            }
        }
        .navigationTitle("Focus Areas")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func toggleArea(_ area: FocusArea) {
        if let index = selectedAreas.firstIndex(of: area) {
            selectedAreas.remove(at: index)
        } else {
            selectedAreas.append(area)
        }
    }
}

#Preview {
    CoachPreferencesView()
}
