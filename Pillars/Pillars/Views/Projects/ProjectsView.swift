//
//  ProjectsView.swift
//  Squirrel2
//
//  Main container view for the Projects list
//

import SwiftUI

struct ProjectsView: View {
    @StateObject private var viewModel = ProjectsViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    @State private var selectedProject: Project?
    @State private var showingCreateSheet = false
    @State private var showingEditSheet = false
    @State private var projectToEdit: Project?
    
    var onMenuTapped: (() -> Void)?
    var onProjectSelected: ((Project) -> Void)?
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header
                ProjectsViewHeader(
                    onMenuTapped: onMenuTapped,
                    onCreateTapped: { showingCreateSheet = true }
                )
                
                // Content
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.projects.isEmpty {
                    ProjectsEmptyState(onCreateTapped: { showingCreateSheet = true })
                } else {
                    ProjectsList(
                        projects: viewModel.projects,
                        onProjectTap: { project in
                            selectedProject = project
                            onProjectSelected?(project)
                        },
                        onEditProject: { project in
                            projectToEdit = project
                            showingEditSheet = true
                        },
                        onDeleteProject: { project in
                            Task {
                                try? await viewModel.deleteProject(project)
                            }
                        }
                    )
                }
            }
            .navigationBarHidden(true)
            .background(S2.Colors.primarySurface)
        }
        .sheet(isPresented: $showingCreateSheet) {
            ProjectFormView(mode: .create) { name, description, color, icon in
                Task {
                    _ = try? await viewModel.createProject(
                        name: name,
                        description: description,
                        color: color,
                        icon: icon
                    )
                }
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showingEditSheet) {
            if let project = projectToEdit {
                ProjectFormView(mode: .edit(project)) { name, description, color, icon in
                    Task {
                        try? await viewModel.updateProject(
                            project,
                            name: name,
                            description: description,
                            color: color,
                            icon: icon
                        )
                    }
                }
                .presentationDetents([.medium, .large])
            }
        }
        .fullScreenCover(item: $selectedProject) { project in
            ProjectDetailView(project: project)
                .environmentObject(firebaseManager)
        }
        .onAppear {
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId)
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }
}

#Preview {
    ProjectsView()
}

