//
//  ConversationMenuContent.swift
//  Squirrel2
//
//  Shared menu content for conversation actions (drawer items + header menu)
//

import SwiftUI

struct ConversationMenuContent: View {
    let conversation: Conversation
    var projects: [Project] = []
    var currentProject: Project? = nil  // When set, "Remove from Project" removes from this project directly
    var onAddToProject: ((Conversation, Project) -> Void)?
    var onRemoveFromProject: ((Conversation, Project) -> Void)?
    var onCreateProject: (() -> Void)?
    var onRename: ((Conversation) -> Void)?
    var onShare: ((Conversation) -> Void)?
    var onDelete: ((Conversation) -> Void)?
    
    // Projects that this conversation is currently in
    private var assignedProjects: [Project] {
        projects.filter { conversation.pillarIds.contains($0.id) }
    }
    
    // Projects that this conversation is NOT in (for adding)
    private var unassignedProjects: [Project] {
        projects.filter { !conversation.pillarIds.contains($0.id) }
    }
    
    var body: some View {
        // Move/Add to Project submenu (only show projects not already assigned)
        if !unassignedProjects.isEmpty || projects.isEmpty {
            Menu {
                ForEach(unassignedProjects) { project in
                    Button {
                        onAddToProject?(conversation, project)
                    } label: {
                        Label(project.name, systemImage: "folder")
                    }
                }
                
                if !unassignedProjects.isEmpty {
                    Divider()
                }
                
                Button {
                    onCreateProject?()
                } label: {
                    Label("Create Project", systemImage: "plus")
                }
            } label: {
                // Use "Move" when in a project context, "Add" otherwise
                Label(currentProject != nil ? "Move to Project" : "Add to Project", systemImage: "folder.badge.plus")
            }
        }
        
        // Remove from Project - simple button when in a project context, submenu otherwise
        if let currentProject = currentProject {
            // Direct removal from current project (not destructive styling)
            Button {
                onRemoveFromProject?(conversation, currentProject)
            } label: {
                Label("Remove from Project", systemImage: "folder.badge.minus")
            }
        } else if !assignedProjects.isEmpty {
            // Submenu when viewing from drawer/general context
            Menu {
                ForEach(assignedProjects) { project in
                    Button {
                        onRemoveFromProject?(conversation, project)
                    } label: {
                        Label(project.name, systemImage: "folder")
                    }
                }
            } label: {
                Label("Remove from Project", systemImage: "folder.badge.minus")
            }
        }
        
        Button {
            onRename?(conversation)
        } label: {
            Label("Rename", systemImage: "pencil")
        }
        
        Button {
            onShare?(conversation)
        } label: {
            Label("Share", systemImage: "square.and.arrow.up")
        }
        
        Divider()
        
        Button(role: .destructive) {
            onDelete?(conversation)
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }
}

