import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar";
import { Bot, BookOpen, MessageSquare, MessagesSquare } from "lucide-react";

type NavigationKey = "content" | "chat" | "agents" | "group-chat";

type SidebarItem = {
  navKey: NavigationKey;
  title: string;
  description: string;
  icon: typeof Bot;
};

const contentItems: SidebarItem[] = [
  {
    navKey: "content",
    title: "Onboarding Content",
    description: "Pillars, themes, principles",
    icon: BookOpen
  },
  {
    navKey: "chat",
    title: "Content Assistant",
    description: "AI-powered content creation",
    icon: MessageSquare
  }
];

const agentItems: SidebarItem[] = [
  {
    navKey: "agents",
    title: "Agents",
    description: "Configure AI agents",
    icon: Bot
  },
  {
    navKey: "group-chat",
    title: "Group Chat",
    description: "Chat with @ mentions",
    icon: MessagesSquare
  }
];

type AppSidebarProps = {
  active: NavigationKey;
  onSelect: (key: NavigationKey) => void;
};

export function AppSidebar({ active, onSelect }: AppSidebarProps) {
  return (
    <Sidebar className="relative">
      <SidebarRail />
      <SidebarHeader className="flex items-center gap-2 px-2 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight">Pillars</span>
          <span className="text-xs text-muted-foreground">Admin Panel</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Content Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active === item.navKey}
                    className="flex flex-col items-start gap-1 text-left"
                  >
                    <button
                      type="button"
                      className="w-full"
                      onClick={() => onSelect(item.navKey)}
                    >
                      <div className="flex w-full items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{item.title}</span>
                      </div>
                      <span className="text-xs font-normal text-muted-foreground">
                        {item.description}
                      </span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Agent System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agentItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active === item.navKey}
                    className="flex flex-col items-start gap-1 text-left"
                  >
                    <button
                      type="button"
                      className="w-full"
                      onClick={() => onSelect(item.navKey)}
                    >
                      <div className="flex w-full items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{item.title}</span>
                      </div>
                      <span className="text-xs font-normal text-muted-foreground">
                        {item.description}
                      </span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flex flex-col gap-1">
        <span className="text-xs font-medium text-sidebar-foreground">Claude Sonnet 4.5</span>
        <span className="text-xs text-muted-foreground">
          Web search enabled
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
