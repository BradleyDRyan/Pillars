import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ContentView } from "@/components/ContentView";
import { AdminChat } from "@/components/AdminChat";
import { AgentView } from "@/components/AgentView";
import { GroupChatView } from "@/components/GroupChatView";

type NavItem = "content" | "chat" | "agents" | "group-chat";

const EMPTY_STATUS: Status | null = null;

function App() {
  const [activeView, setActiveView] = useState<NavItem>("content");

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar active={activeView} onSelect={setActiveView} />
        <main className="flex-1 overflow-y-auto bg-muted/20 px-4 py-6 sm:px-8">
          {activeView === "content" && (
            <ContentView />
          )}
          {activeView === "chat" && (
            <AdminChat />
          )}
          {activeView === "agents" && (
            <AgentView />
          )}
          {activeView === "group-chat" && (
            <GroupChatView />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}

export default App;
