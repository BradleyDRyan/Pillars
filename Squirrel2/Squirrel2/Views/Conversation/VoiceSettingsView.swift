//
//  VoiceSettingsView.swift
//  Squirrel2
//
//  Voice settings for OpenAI Realtime API configuration
//

import SwiftUI

struct VoiceSettingsView: View {
    @AppStorage("voiceSettings.voice") private var selectedVoice = "shimmer"
    @AppStorage("voiceSettings.turnDetection.threshold") private var vadThreshold = 0.5
    @AppStorage("voiceSettings.turnDetection.silenceDuration") private var silenceDuration = 400
    @AppStorage("voiceSettings.turnDetection.prefixPadding") private var prefixPadding = 300
    @AppStorage("voiceSettings.audioGain") private var audioGain = 1.5
    @AppStorage("voiceSettings.speakingSpeed") private var speakingSpeed = "fast"
    @Environment(\.dismiss) private var dismiss

    let availableVoices = [
        ("alloy", "Alloy - Neutral"),
        ("ash", "Ash - Confident"),
        ("ballad", "Ballad - Warm"),
        ("cedar", "Cedar - Warm"),
        ("coral", "Coral - Friendly"),
        ("echo", "Echo - Conversational"),
        ("marin", "Marin - Clear"),
        ("sage", "Sage - Calm"),
        ("shimmer", "Shimmer - Energetic"),
        ("verse", "Verse - Professional")
    ]

    var body: some View {
        NavigationView {
            Form {
                // Voice Selection
                Section {
                    Picker("Voice", selection: $selectedVoice) {
                        ForEach(availableVoices, id: \.0) { voice in
                            Text(voice.1).tag(voice.0)
                        }
                    }
                    .pickerStyle(.menu)

                    Picker("Speaking Speed", selection: $speakingSpeed) {
                        Text("Slow").tag("slow")
                        Text("Normal").tag("normal")
                        Text("Fast").tag("fast")
                        Text("Very Fast").tag("very_fast")
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Voice Selection")
                } footer: {
                    Text("Choose the AI voice personality and speaking speed")
                }

                // Audio Settings
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Output Volume Boost")
                            .font(.squirrelSubheadline)

                        HStack {
                            Image(systemName: "speaker.fill")
                                .foregroundColor(.secondary)

                            Slider(value: $audioGain, in: 1.0...3.0, step: 0.1)

                            Text("\(Int(audioGain * 100))%")
                                .font(.squirrelCaption)
                                .foregroundColor(.secondary)
                                .frame(width: 45, alignment: .trailing)
                        }
                    }
                } header: {
                    Text("Audio Settings")
                } footer: {
                    Text("Adjust the AI voice output volume. Default is 150% for better audibility.")
                }

                // Voice Activity Detection
                Section {
                    VStack(alignment: .leading, spacing: 16) {
                        // VAD Threshold
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Detection Sensitivity")
                                .font(.squirrelSubheadline)

                            HStack {
                                Text("Less")
                                    .font(.squirrelCaption)
                                    .foregroundColor(.secondary)

                                Slider(value: $vadThreshold, in: 0.0...1.0, step: 0.1)

                                Text("More")
                                    .font(.squirrelCaption)
                                    .foregroundColor(.secondary)
                            }

                            Text("Current: \(vadThreshold, specifier: "%.1f")")
                                .font(.squirrelFootnote)
                                .foregroundColor(.secondary)
                        }

                        // Silence Duration
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Silence Duration")
                                .font(.squirrelSubheadline)

                            HStack {
                                Text("\(Int(silenceDuration))ms")
                                    .font(.squirrelCaption)
                                    .foregroundColor(.secondary)
                                    .frame(width: 60)

                                Slider(value: Binding(
                                    get: { Double(silenceDuration) },
                                    set: { silenceDuration = Int($0) }
                                ), in: 200...1000, step: 100)
                            }

                            Text("How long to wait after you stop speaking")
                                .font(.squirrelFootnote)
                                .foregroundColor(.secondary)
                        }

                        // Prefix Padding
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Speech Buffer")
                                .font(.squirrelSubheadline)

                            HStack {
                                Text("\(Int(prefixPadding))ms")
                                    .font(.squirrelCaption)
                                    .foregroundColor(.secondary)
                                    .frame(width: 60)

                                Slider(value: Binding(
                                    get: { Double(prefixPadding) },
                                    set: { prefixPadding = Int($0) }
                                ), in: 0...500, step: 50)
                            }

                            Text("Include audio before speech detection")
                                .font(.squirrelFootnote)
                                .foregroundColor(.secondary)
                        }
                    }
                } header: {
                    Text("Turn Detection")
                } footer: {
                    Text("Configure when the AI should respond to your speech")
                }

                // Reset Section
                Section {
                    Button(action: resetToDefaults) {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                            Text("Reset to Defaults")
                        }
                        .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Voice Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func resetToDefaults() {
        selectedVoice = "shimmer"
        vadThreshold = 0.5
        silenceDuration = 400
        prefixPadding = 300
        audioGain = 1.5
        speakingSpeed = "fast"
    }
}

struct VoiceSettingsView_Previews: PreviewProvider {
    static var previews: some View {
        VoiceSettingsView()
    }
}