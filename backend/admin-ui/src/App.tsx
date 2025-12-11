import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DataTable } from "@/components/data-table";
import { columns as peopleColumns, type Person } from "@/components/people-columns";
import { columns as signalsColumns } from "@/components/signals-columns";
import { columns as triggersColumns } from "@/components/triggers-columns";
import { createMonitorsColumns } from "@/components/monitors-columns";
import { ContentView } from "@/components/ContentView";

type PersonOption = {
  id: string;
  label: string;
};

type Status = {
  tone: "success" | "error" | "info";
  message: string;
};

type MonitorSummary = {
  id: string;
  name: string;
  type?: string;
  instructions: string;
  model?: string | null;
  enableWebSearch: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type Assignment = {
  id: string;
  monitorId: string;
  personId: string;
  userId?: string | null;
  status: string;
  runCount: number;
  lastRunAt: string | null;
  lastResult?: {
    eventId?: string;
    type?: string;
    description?: string;
    importance?: number;
    occurredAt?: string;
    message?: string;
  } | null;
  lastError?: string | null;
  monitor: MonitorSummary | null;
  person?: {
    id: string;
    userId?: string;
    name: string;
    relationship?: string;
    sharedInterests?: string[];
    importantDates?: Array<{
      type: string;
      date: string;
      label: string;
    }>;
  } | null;
};

type Signal = {
  id: string;
  userId: string | null;
  personId: string | null;
  monitorId: string | null;
  type: string;
  source: string;
  description: string;
  importance: number;
  occurredAt: string | null;
  createdAt: string | null;
  metadata: {
    monitorName?: string;
    model?: string | null;
    runStartedAt?: string;
    rawAiOutput?: string;
  };
};

const EMPTY_STATUS: Status | null = null;

type MonitorFormState = {
  name: string;
  type: string;
  personId: string;
  instructions: string;
  model: string;
  enableWebSearch: boolean;
};

const defaultFormState = () => ({
  personId: "",
  type: "",
  source: "",
  occurredAt: new Date().toISOString().slice(0, 10),
  importance: 50,
  description: ""
});

const defaultMonitorFormState = (): MonitorFormState => ({
  name: "",
  type: "shared_interest",
  personId: "",
  instructions: "",
  model: "claude-sonnet-4-5",
  enableWebSearch: true
});

type PersonFormState = {
  name: string;
  relationship: string;
  sharedInterests: string;
  importantDates: Array<{
    type: string;
    date: string;
    label: string;
  }>;
};

const defaultPersonFormState = (): PersonFormState => ({
  name: "",
  relationship: "",
  sharedInterests: "",
  importantDates: []
});

type ScheduledTriggerFormState = {
  monitorId: string;
  schedule: string;
  enabled: boolean;
};

const defaultScheduledTriggerFormState = (): ScheduledTriggerFormState => ({
  monitorId: "",
  schedule: "",
  enabled: true
});

type ScheduledTrigger = {
  id: string;
  monitorId: string;
  schedule: string;
  enabled: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const TYPE_OPTIONS = [
  {
    value: "shared_interest",
    label: "Shared Interest",
    description: "Monitors news and events related to shared interests"
  },
  {
    value: "event",
    label: "Event",
    description: "Monitors important dates and upcoming events"
  }
];

const MODEL_OPTIONS = [
  {
    value: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5"
  },
  {
    value: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4 (2025-05-14)"
  },
  {
    value: "claude-3-7-sonnet-20250219",
    label: "Claude Sonnet 3.7 (2025-02-19)"
  },
  {
    value: "claude-3-5-sonnet-latest",
    label: "Claude Sonnet 3.5 v2 (legacy)"
  }
];

const normalizeAssignment = (assignment: any): Assignment => ({
  ...assignment,
  monitor: assignment?.monitor
    ? {
        ...assignment.monitor,
        enableWebSearch: Boolean(assignment.monitor.enableWebSearch)
      }
    : null,
  person: assignment?.person ?? null
});

type NavItem = "people" | "scheduled-triggers" | "monitors" | "signals" | "content";
type TriggerFormState = ReturnType<typeof defaultFormState>;
type TriggerFieldUpdater = (key: keyof TriggerFormState, value: string | number) => void;
type MonitorFieldUpdater = <K extends keyof MonitorFormState>(key: K, value: MonitorFormState[K]) => void;

function App() {
  const [activeView, setActiveView] = useState<NavItem>("people");

  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(EMPTY_STATUS);
  const [form, setForm] = useState(defaultFormState);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [monitorStatus, setMonitorStatus] = useState<Status | null>(EMPTY_STATUS);
  const [monitorForm, setMonitorForm] = useState(defaultMonitorFormState);
  const [monitorSaving, setMonitorSaving] = useState(false);
  const [runningAssignments, setRunningAssignments] = useState<Record<string, boolean>>({});
  const [monitorDialogOpen, setMonitorDialogOpen] = useState(false);
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [signalsStatus, setSignalsStatus] = useState<Status | null>(EMPTY_STATUS);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [deletingSignal, setDeletingSignal] = useState(false);
  const [signalRowSelection, setSignalRowSelection] = useState({});
  const [deletingBulkSignals, setDeletingBulkSignals] = useState(false);

  const [personForm, setPersonForm] = useState(defaultPersonFormState);
  const [personSaving, setPersonSaving] = useState(false);
  const [personStatus, setPersonStatus] = useState<Status | null>(EMPTY_STATUS);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);

  const [triggers, setTriggers] = useState<ScheduledTrigger[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(true);
  const [triggerForm, setTriggerForm] = useState(defaultScheduledTriggerFormState);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [triggerSaving, setTriggerSaving] = useState(false);
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
  const [triggerStatus, setTriggerStatus] = useState<Status | null>(EMPTY_STATUS);

  const importanceLabel = useMemo(() => `${form.importance}/100`, [form.importance]);

  const updateField = useCallback<TriggerFieldUpdater>((key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const resetForm = useCallback(() => {
    setForm(defaultFormState());
  }, []);

  const updateMonitorField = useCallback<MonitorFieldUpdater>((key, value) => {
    setMonitorForm(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const resetMonitorForm = useCallback(() => {
    setMonitorForm(defaultMonitorFormState());
  }, []);

  const handleMonitorDialogChange = useCallback(
    (open: boolean) => {
      setMonitorDialogOpen(open);
      if (!open) {
        resetMonitorForm();
        setEditingMonitorId(null);
      }
    },
    [resetMonitorForm]
  );

  const updatePersonField = useCallback(<K extends keyof PersonFormState>(key: K, value: PersonFormState[K]) => {
    setPersonForm(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const resetPersonForm = useCallback(() => {
    setPersonForm(defaultPersonFormState());
  }, []);

  const handlePersonDialogChange = useCallback(
    (open: boolean) => {
      setPersonDialogOpen(open);
      if (!open) {
        resetPersonForm();
        setEditingPersonId(null);
      }
    },
    [resetPersonForm]
  );

  const updateTriggerField = useCallback(<K extends keyof ScheduledTriggerFormState>(key: K, value: ScheduledTriggerFormState[K]) => {
    setTriggerForm(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const resetTriggerForm = useCallback(() => {
    setTriggerForm(defaultScheduledTriggerFormState());
  }, []);

  const handleTriggerDialogChange = useCallback(
    (open: boolean) => {
      setTriggerDialogOpen(open);
      if (!open) {
        resetTriggerForm();
        setEditingTriggerId(null);
      }
    },
    [resetTriggerForm]
  );

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    setStatus(EMPTY_STATUS);
    try {
      const response = await fetch("/connection-admin/api/people");
      if (!response.ok) {
        throw new Error("Failed to load people");
      }
      const data = await response.json();
      const formatted: PersonOption[] = (data.people ?? []).map(
        (person: { id: string; name: string; relationship?: string }) => ({
          id: person.id,
          label: person.relationship
            ? `${person.name} — ${person.relationship}`
            : person.name
        })
      );
      setPeople(formatted);
      if (formatted.length === 0) {
        setStatus({
          tone: "info",
          message:
            "No people found yet. People appear here once they sync—try refreshing or check back shortly."
        });
      }
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "There was a problem loading connections."
      });
    } finally {
      setLoadingPeople(false);
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const response = await fetch("/connection-admin/api/monitors");
      if (!response.ok) {
        throw new Error("Failed to load monitors");
      }
      const data = await response.json();
      setAssignments(
        Array.isArray(data.assignments)
          ? data.assignments.map(normalizeAssignment)
          : []
      );
      setMonitorStatus(EMPTY_STATUS);
    } catch (error) {
      console.error(error);
      setMonitorStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "There was a problem loading monitors."
      });
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  const handleEditPerson = useCallback(
    async (personId: string) => {
      try {
        const response = await fetch("/connection-admin/api/people");
        if (!response.ok) throw new Error("Failed to load people");

        const data = await response.json();
        const person = (data.people ?? []).find((p: any) => p.id === personId);

        if (person) {
          setPersonForm({
            name: person.name,
            relationship: person.relationship || "",
            sharedInterests: (person.sharedInterests || []).join(", "),
            importantDates: person.importantDates || []
          });
          setEditingPersonId(personId);
          setPersonDialogOpen(true);
        }
      } catch (error) {
        console.error("Failed to load person for editing:", error);
      }
    },
    []
  );

  const handlePersonSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!personForm.name.trim()) {
        setPersonStatus({
          tone: "error",
          message: "Name is required"
        });
        return;
      }

      setPersonSaving(true);
      setPersonStatus(EMPTY_STATUS);
      try {
        const sharedInterestsArray = personForm.sharedInterests
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        const isEditing = Boolean(editingPersonId);
        const url = isEditing
          ? `/connection-admin/api/people/${editingPersonId}`
          : "/connection-admin/api/people";
        const method = isEditing ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: personForm.name.trim(),
            relationship: personForm.relationship.trim(),
            sharedInterests: sharedInterestsArray,
            importantDates: personForm.importantDates
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `Failed to ${isEditing ? "update" : "create"} person`);
        }

        setPersonStatus({
          tone: "success",
          message: `Person "${personForm.name}" ${isEditing ? "updated" : "created"}.`
        });
        resetPersonForm();
        setEditingPersonId(null);
        setPersonDialogOpen(false);
        loadPeople(); // Refresh the people list
      } catch (error) {
        setPersonStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to save person"
        });
      } finally {
        setPersonSaving(false);
      }
    },
    [personForm, resetPersonForm, loadPeople, editingPersonId]
  );

  const handleDeletePerson = useCallback(
    async (personId: string) => {
      if (!confirm('Are you sure you want to delete this person? This will also delete all monitors, assignments, and signals for this person and cannot be undone.')) {
        return;
      }

      setPersonStatus(EMPTY_STATUS);
      try {
        const response = await fetch(`/connection-admin/api/people/${personId}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to delete person");
        }

        setPersonStatus({
          tone: "success",
          message: "Person deleted successfully"
        });

        loadPeople(); // Refresh the list
        loadAssignments(); // Refresh monitors since they might be deleted too
      } catch (error) {
        console.error(error);
        setPersonStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to delete person"
        });
      }
    },
    [loadPeople, loadAssignments]
  );

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const loadSignals = useCallback(async () => {
    setLoadingSignals(true);
    try {
      const response = await fetch("/connection-admin/api/signals");
      if (!response.ok) {
        throw new Error("Failed to load signals");
      }
      const data = await response.json();
      setSignals(Array.isArray(data.signals) ? data.signals : []);
      setSignalsStatus(EMPTY_STATUS);
    } catch (error) {
      console.error(error);
      setSignalsStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "There was a problem loading signals."
      });
    } finally {
      setLoadingSignals(false);
    }
  }, []);

  const handleDeleteSignal = useCallback(
    async (signalId: string) => {
      if (!confirm('Are you sure you want to delete this signal? This action cannot be undone.')) {
        return;
      }

      setDeletingSignal(true);
      setSignalsStatus(EMPTY_STATUS);
      try {
        const response = await fetch(`/connection-admin/api/signals/${signalId}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to delete signal");
        }

        setSignalsStatus({
          tone: "success",
          message: "Signal deleted successfully"
        });

        // Close the modal
        setSelectedSignal(null);

        // Refresh the signals list
        loadSignals();
      } catch (error) {
        console.error(error);
        setSignalsStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to delete signal"
        });
      } finally {
        setDeletingSignal(false);
      }
    },
    [loadSignals]
  );

  const handleBulkDeleteSignals = useCallback(
    async () => {
      const selectedIds = Object.keys(signalRowSelection).filter(
        (key) => signalRowSelection[key as keyof typeof signalRowSelection]
      );

      if (selectedIds.length === 0) {
        return;
      }

      if (!confirm(`Are you sure you want to delete ${selectedIds.length} signal(s)? This action cannot be undone.`)) {
        return;
      }

      setDeletingBulkSignals(true);
      setSignalsStatus(EMPTY_STATUS);
      try {
        const response = await fetch(`/connection-admin/api/signals/bulk-delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ids: selectedIds })
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to delete signals");
        }

        setSignalsStatus({
          tone: "success",
          message: `${selectedIds.length} signal(s) deleted successfully`
        });

        // Clear selection
        setSignalRowSelection({});

        // Refresh the signals list
        loadSignals();
      } catch (error) {
        console.error(error);
        setSignalsStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to delete signals"
        });
      } finally {
        setDeletingBulkSignals(false);
      }
    },
    [signalRowSelection, loadSignals]
  );

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  const loadTriggers = useCallback(async () => {
    setLoadingTriggers(true);
    try {
      const response = await fetch("/connection-admin/api/triggers");
      if (!response.ok) {
        throw new Error("Failed to load triggers");
      }
      const data = await response.json();
      setTriggers(Array.isArray(data.triggers) ? data.triggers : []);
      setTriggerStatus(EMPTY_STATUS);
    } catch (error) {
      console.error(error);
      setTriggerStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "There was a problem loading triggers."
      });
    } finally {
      setLoadingTriggers(false);
    }
  }, []);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form.personId || !form.type || !form.description) {
        setStatus({
          tone: "error",
          message: "Please fill all required fields."
        });
        return;
      }

      setSaving(true);
      setStatus(EMPTY_STATUS);
      try {
        const response = await fetch("/connection-admin/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personId: form.personId,
            type: form.type.trim(),
            source: form.source.trim(),
            occurredAt: form.occurredAt,
            importance: form.importance,
            description: form.description.trim()
          })
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.error || "Failed to create event");
        }

        const { event: createdEvent } = await response.json();
        setStatus({
          tone: "success",
          message: `Saved! "${createdEvent.type}" added to the stream.`
        });
        resetForm();
      } catch (error) {
        console.error(error);
        setStatus({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong while saving."
        });
      } finally {
        setSaving(false);
      }
    },
    [form, resetForm]
  );

  const handleEditMonitor = useCallback(
    (assignment: Assignment) => {
      const monitor = assignment.monitor;
      if (!monitor) return;

      setMonitorForm({
        name: monitor.name,
        type: monitor.type || "shared_interest",
        personId: assignment.personId,
        instructions: monitor.instructions,
        model: monitor.model || "claude-sonnet-4-5",
        enableWebSearch: monitor.enableWebSearch
      });
      setEditingMonitorId(monitor.id);
      setMonitorDialogOpen(true);
    },
    []
  );

  const handleMonitorSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!monitorForm.personId || !monitorForm.name.trim() || !monitorForm.instructions.trim()) {
        setMonitorStatus({
          tone: "error",
          message: "Please provide a name, target person, and instructions."
        });
        return;
      }

      setMonitorSaving(true);
      setMonitorStatus(EMPTY_STATUS);
      try {
        const isEditing = Boolean(editingMonitorId);
        const url = isEditing
          ? `/connection-admin/api/monitors/${editingMonitorId}`
          : "/connection-admin/api/monitors";
        const method = isEditing ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: monitorForm.name.trim(),
            type: monitorForm.type,
            personId: monitorForm.personId,
            instructions: monitorForm.instructions.trim(),
            model: monitorForm.model,
            enableWebSearch: monitorForm.enableWebSearch
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `Failed to ${isEditing ? "update" : "create"} monitor`);
        }

        if (isEditing) {
          // Refresh the assignments list to show updated data
          await loadAssignments();
          setMonitorStatus({
            tone: "success",
            message: `Monitor "${monitorForm.name}" updated.`
          });
        } else if (payload.assignment) {
          setAssignments(prev => [normalizeAssignment(payload.assignment), ...prev]);
          setMonitorStatus({
            tone: "success",
            message: `Monitor "${payload.assignment.monitor?.name ?? monitorForm.name}" created.`
          });
        }
        resetMonitorForm();
        setEditingMonitorId(null);
        setMonitorDialogOpen(false);
      } catch (error) {
        console.error(error);
        setMonitorStatus({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong while saving the monitor."
        });
      } finally {
        setMonitorSaving(false);
      }
    },
    [monitorForm, resetMonitorForm, editingMonitorId, loadAssignments]
  );

  const handleRunAssignment = useCallback(
    async (assignmentId: string) => {
      setRunningAssignments(prev => ({ ...prev, [assignmentId]: true }));
      setMonitorStatus(EMPTY_STATUS);

      try {
        const response = await fetch(`/connection-admin/api/monitors/${assignmentId}/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to run monitor");
        }

        if (payload.assignment) {
          setAssignments(prev =>
            prev.map(item =>
              item.id === assignmentId ? normalizeAssignment(payload.assignment) : item
            )
          );
        }

        if (payload.signal) {
          const monitorName = payload.assignment?.monitor?.name ?? "Monitor";
          setMonitorStatus({
            tone: "success",
            message: `${monitorName} created signal: "${payload.signal.description}" (importance: ${payload.signal.importance})`
          });
          // Refresh signals list to show the new signal
          loadSignals();
        } else {
          setMonitorStatus({
            tone: "info",
            message: "Monitor run completed without generating a signal."
          });
        }
      } catch (error) {
        console.error(error);
        setMonitorStatus({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to run monitor."
        });
      } finally {
        setRunningAssignments(prev => {
          const next = { ...prev };
          delete next[assignmentId];
          return next;
        });
      }
    },
    [loadSignals]
  );

  const handleDeleteMonitor = useCallback(
    async (monitorId: string) => {
      if (!confirm('Are you sure you want to delete this monitor? This will also delete all its assignments and cannot be undone.')) {
        return;
      }

      setMonitorStatus(EMPTY_STATUS);
      try {
        const response = await fetch(`/connection-admin/api/monitors/${monitorId}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to delete monitor");
        }

        // Remove the deleted monitor's assignments from the list
        setAssignments(prev => prev.filter(a => a.monitor?.id !== monitorId));

        setMonitorStatus({
          tone: "success",
          message: "Monitor deleted successfully"
        });

        loadAssignments(); // Refresh the list
      } catch (error) {
        console.error(error);
        setMonitorStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to delete monitor"
        });
      }
    },
    [loadAssignments]
  );

  const formatTimestamp = useCallback((value: string | null | undefined) => {
    return value ? new Date(value).toLocaleString() : "Never";
  }, []);

  const handleEditTrigger = useCallback(
    async (triggerId: string) => {
      try {
        const trigger = triggers.find(t => t.id === triggerId);
        if (trigger) {
          setTriggerForm({
            monitorId: trigger.monitorId,
            schedule: trigger.schedule,
            enabled: trigger.enabled
          });
          setEditingTriggerId(triggerId);
          setTriggerDialogOpen(true);
        }
      } catch (error) {
        console.error("Failed to load trigger for editing:", error);
      }
    },
    [triggers]
  );

  const handleTriggerSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!triggerForm.monitorId || !triggerForm.schedule.trim()) {
        setTriggerStatus({
          tone: "error",
          message: "Monitor and schedule are required"
        });
        return;
      }

      setTriggerSaving(true);
      setTriggerStatus(EMPTY_STATUS);
      try {
        const isEditing = Boolean(editingTriggerId);
        const url = isEditing
          ? `/connection-admin/api/triggers/${editingTriggerId}`
          : "/connection-admin/api/triggers";
        const method = isEditing ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            monitorId: triggerForm.monitorId,
            schedule: triggerForm.schedule.trim(),
            enabled: triggerForm.enabled
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `Failed to ${isEditing ? "update" : "create"} trigger`);
        }

        setTriggerStatus({
          tone: "success",
          message: `Trigger ${isEditing ? "updated" : "created"}.`
        });
        resetTriggerForm();
        setEditingTriggerId(null);
        setTriggerDialogOpen(false);
        loadTriggers(); // Refresh the triggers list
      } catch (error) {
        setTriggerStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to save trigger"
        });
      } finally {
        setTriggerSaving(false);
      }
    },
    [triggerForm, resetTriggerForm, loadTriggers, editingTriggerId]
  );

  const handleDeleteTrigger = useCallback(
    async (triggerId: string) => {
      if (!confirm('Are you sure you want to delete this scheduled trigger? This cannot be undone.')) {
        return;
      }

      setTriggerStatus(EMPTY_STATUS);
      try {
        const response = await fetch(`/connection-admin/api/triggers/${triggerId}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to delete trigger");
        }

        setTriggerStatus({
          tone: "success",
          message: "Trigger deleted successfully"
        });

        loadTriggers(); // Refresh the list
      } catch (error) {
        console.error(error);
        setTriggerStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "Failed to delete trigger"
        });
      }
    },
    [loadTriggers]
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar active={activeView} onSelect={setActiveView} />
        <main className="flex-1 overflow-y-auto bg-muted/20 px-4 py-6 sm:px-8">
          {activeView === "people" && (
            <PeopleView
              people={people}
              loadingPeople={loadingPeople}
              personForm={personForm}
              personStatus={personStatus}
              personSaving={personSaving}
              personDialogOpen={personDialogOpen}
              editingPersonId={editingPersonId}
              onUpdateField={updatePersonField}
              onSubmit={handlePersonSubmit}
              onDialogChange={handlePersonDialogChange}
              onEdit={handleEditPerson}
              onDelete={handleDeletePerson}
            />
          )}
          {activeView === "scheduled-triggers" && (
            <ScheduledTriggersView
              triggers={triggers}
              loadingTriggers={loadingTriggers}
              triggerForm={triggerForm}
              triggerStatus={triggerStatus}
              triggerSaving={triggerSaving}
              triggerDialogOpen={triggerDialogOpen}
              editingTriggerId={editingTriggerId}
              assignments={assignments}
              onDialogChange={handleTriggerDialogChange}
              onUpdateField={updateTriggerField}
              onSubmit={handleTriggerSubmit}
              onEdit={handleEditTrigger}
              onDelete={handleDeleteTrigger}
            />
          )}
          {activeView === "monitors" && (
            <MonitorsView
              people={people}
              assignments={assignments}
              loadingAssignments={loadingAssignments}
              monitorForm={monitorForm}
              monitorStatus={monitorStatus}
              monitorSaving={monitorSaving}
              runningAssignments={runningAssignments}
              loadingPeople={loadingPeople}
              designerOpen={monitorDialogOpen}
              editingMonitorId={editingMonitorId}
              onDesignerOpenChange={handleMonitorDialogChange}
              onUpdateField={updateMonitorField}
              onSubmit={handleMonitorSubmit}
              onReset={() => {
                resetMonitorForm();
                setMonitorStatus(EMPTY_STATUS);
              }}
              onRun={handleRunAssignment}
              onEdit={handleEditMonitor}
              onDelete={handleDeleteMonitor}
              formatTimestamp={formatTimestamp}
            />
          )}
          {activeView === "signals" && (
            <SignalsView
              signals={signals}
              loadingSignals={loadingSignals}
              signalsStatus={signalsStatus}
              formatTimestamp={formatTimestamp}
              selectedSignal={selectedSignal}
              onSelectSignal={setSelectedSignal}
              onDeleteSignal={handleDeleteSignal}
              deletingSignal={deletingSignal}
              rowSelection={signalRowSelection}
              onRowSelectionChange={setSignalRowSelection}
              onBulkDelete={handleBulkDeleteSignals}
              deletingBulk={deletingBulkSignals}
            />
          )}
          {activeView === "content" && (
            <ContentView />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}

type TriggerViewProps = {
  people: PersonOption[];
  form: TriggerFormState;
  status: Status | null;
  saving: boolean;
  loadingPeople: boolean;
  importanceLabel: string;
  onUpdateField: TriggerFieldUpdater;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
};

function TriggerView({
  people,
  form,
  status,
  saving,
  loadingPeople,
  importanceLabel,
  onUpdateField,
  onSubmit,
  onReset
}: TriggerViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Manual trigger</h1>
        <p className="text-sm text-muted-foreground">
          Log a signal yourself while we validate the signal pipeline.
        </p>
      </header>

      {status && (
        <div
          className={cn(
            "px-4 py-3 text-sm",
            status.tone === "success" && "bg-green-50 text-green-800",
            status.tone === "error" && "bg-red-50 text-red-800",
            status.tone === "info" && "bg-muted/60 text-muted-foreground"
          )}
        >
          {status.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manual event</CardTitle>
          <CardDescription>
            Create a single high-signal event for someone in your inner circle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="trigger-person">Person</Label>
              <Select
                value={form.personId}
                onValueChange={value => onUpdateField("personId", value)}
                disabled={loadingPeople || people.length === 0}
              >
                <SelectTrigger id="trigger-person">
                  <SelectValue placeholder={loadingPeople ? "Loading..." : "Select…"} />
                </SelectTrigger>
                <SelectContent>
                  {people.map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trigger-type">Event type</Label>
                <Input
                  id="trigger-type"
                  placeholder="e.g., Wimbledon finals"
                  value={form.type}
                  onChange={event => onUpdateField("type", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-source">Source</Label>
                <Input
                  id="trigger-source"
                  placeholder="Manual, ESPN, etc."
                  value={form.source}
                  onChange={event => onUpdateField("source", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trigger-date">Relevant date</Label>
                <Input
                  id="trigger-date"
                  type="date"
                  value={form.occurredAt}
                  onChange={event => onUpdateField("occurredAt", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <Label htmlFor="trigger-importance">Importance</Label>
                  <span className="text-xs text-muted-foreground">{importanceLabel}</span>
                </div>
                <Slider
                  id="trigger-importance"
                  value={[form.importance]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([value]) => onUpdateField("importance", value ?? 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger-description">Description</Label>
              <Textarea
                id="trigger-description"
                placeholder="Why this matters right now."
                value={form.description}
                onChange={event => onUpdateField("description", event.target.value)}
                required
              />
            </div>

            <CardFooter className="justify-end gap-2 px-0">
              <Button
                type="button"
                variant="outline"
                onClick={onReset}
                disabled={saving}
              >
                Reset
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  !form.personId ||
                  !form.type.trim() ||
                  !form.description.trim()
                }
              >
                {saving ? "Saving…" : "Create event"}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

type MonitorsViewProps = {
  people: PersonOption[];
  assignments: Assignment[];
  loadingAssignments: boolean;
  monitorForm: MonitorFormState;
  monitorStatus: Status | null;
  monitorSaving: boolean;
  runningAssignments: Record<string, boolean>;
  loadingPeople: boolean;
  designerOpen: boolean;
  editingMonitorId: string | null;
  onDesignerOpenChange: (open: boolean) => void;
  onUpdateField: MonitorFieldUpdater;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onRun: (assignmentId: string) => void;
  onEdit: (assignment: Assignment) => void;
  onDelete: (monitorId: string) => void;
  formatTimestamp: (value: string | null | undefined) => string;
};

function MonitorsView({
  people,
  assignments,
  loadingAssignments,
  monitorForm,
  monitorStatus,
  monitorSaving,
  runningAssignments,
  loadingPeople,
  designerOpen,
  editingMonitorId,
  onDesignerOpenChange,
  onUpdateField,
  onSubmit,
  onReset,
  onRun,
  onEdit,
  onDelete,
  formatTimestamp
}: MonitorsViewProps) {
  // Convert runningAssignments Record to Set for monitors-columns
  const runningMonitorsSet = new Set(
    Object.entries(runningAssignments)
      .filter(([_, isRunning]) => isRunning)
      .map(([id]) => id)
  );

  const monitorsColumns = createMonitorsColumns(onEdit, onDelete, onRun, runningMonitorsSet);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Monitors</h1>
          <p className="text-sm text-muted-foreground">
            Define Claude-powered collectors and run them manually while triggers roll out.
          </p>
        </div>
        <Dialog open={designerOpen} onOpenChange={onDesignerOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              Create monitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMonitorId ? "Edit monitor" : "Create a monitor"}</DialogTitle>
              <DialogDescription>
                {editingMonitorId
                  ? "Update the monitor configuration and settings."
                  : "Spin up an agent that watches for new context events and logs them to the stream."}
              </DialogDescription>
            </DialogHeader>

            <form id="monitor-form" className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="monitor-name">Monitor name</Label>
                <Input
                  id="monitor-name"
                  placeholder="Tennis interest finder"
                  value={monitorForm.name}
                  onChange={event => onUpdateField("name", event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monitor-person">Person</Label>
                <Select
                  value={monitorForm.personId}
                  onValueChange={value => onUpdateField("personId", value)}
                  disabled={loadingPeople || people.length === 0}
                >
                  <SelectTrigger id="monitor-person">
                    <SelectValue placeholder={loadingPeople ? "Loading..." : "Select…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map(person => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monitor-type">Type</Label>
                <Select
                  value={monitorForm.type}
                  onValueChange={value => onUpdateField("type", value)}
                >
                  <SelectTrigger id="monitor-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monitor-instructions">Instructions</Label>
                <Textarea
                  id="monitor-instructions"
                  placeholder="Explain what signals to look for, what to log, and why it matters."
                  value={monitorForm.instructions}
                  onChange={event => onUpdateField("instructions", event.target.value)}
                  required
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monitor-model">Model</Label>
                <Select
                  value={monitorForm.model}
                  onValueChange={value => onUpdateField("model", value)}
                >
                  <SelectTrigger id="monitor-model">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Claude Sonnet 4.5 supports real-time web search.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    id="monitor-web-search"
                    type="checkbox"
                    checked={monitorForm.enableWebSearch}
                    onChange={event => onUpdateField("enableWebSearch", event.target.checked)}
                    className="h-4 w-4 rounded border border-input"
                  />
                  <Label htmlFor="monitor-web-search" className="text-sm font-medium leading-none">
                    Enable web search
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Allow Claude to call the live web search tool when crafting signals.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onReset}
                  disabled={monitorSaving}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={
                    monitorSaving ||
                    !monitorForm.name.trim() ||
                    !monitorForm.personId ||
                    !monitorForm.instructions.trim()
                  }
                >
                  {monitorSaving ? "Saving…" : "Create monitor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {monitorStatus && (
        <div
          className={cn(
            "px-4 py-3 text-sm",
            monitorStatus.tone === "success" && "bg-green-50 text-green-800",
            monitorStatus.tone === "error" && "bg-red-50 text-red-800",
            monitorStatus.tone === "info" && "bg-muted/60 text-muted-foreground"
          )}
        >
          {monitorStatus.message}
        </div>
      )}

      <Card>
        <CardHeader className="px-4 py-5 sm:px-6">
          <CardTitle className="text-base font-semibold">Active monitors</CardTitle>
          <CardDescription>
            Trigger manual runs while we roll out automatic schedules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAssignments ? (
            <div className="py-6 text-sm text-muted-foreground">Loading assignments…</div>
          ) : assignments.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              No monitors yet. Use "Create monitor" to launch your first agent.
            </div>
          ) : (
            <DataTable
              columns={monitorsColumns}
              data={assignments}
              searchColumn="monitorName"
              searchPlaceholder="Search by monitor name..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type SignalsViewProps = {
  signals: Signal[];
  loadingSignals: boolean;
  signalsStatus: Status | null;
  formatTimestamp: (value: string | null | undefined) => string;
  selectedSignal: Signal | null;
  onSelectSignal: (signal: Signal | null) => void;
  onDeleteSignal: (signalId: string) => void;
  deletingSignal: boolean;
  rowSelection: Record<string, boolean>;
  onRowSelectionChange: (selection: Record<string, boolean>) => void;
  onBulkDelete: () => void;
  deletingBulk: boolean;
};

function SignalsView({
  signals,
  loadingSignals,
  signalsStatus,
  formatTimestamp,
  selectedSignal,
  onSelectSignal,
  onDeleteSignal,
  deletingSignal,
  rowSelection,
  onRowSelectionChange,
  onBulkDelete,
  deletingBulk
}: SignalsViewProps) {
  const selectedCount = Object.keys(rowSelection).filter(key => rowSelection[key]).length;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Signals</h1>
        <p className="text-sm text-muted-foreground">
          Raw events detected by monitors before they're matched to people.
        </p>
      </header>

      {signalsStatus && (
        <div
          className={cn(
            "px-4 py-3 text-sm",
            signalsStatus.tone === "success" && "bg-green-50 text-green-800",
            signalsStatus.tone === "error" && "bg-red-50 text-red-800",
            signalsStatus.tone === "info" && "bg-muted/60 text-muted-foreground"
          )}
        >
          {signalsStatus.message}
        </div>
      )}

      {selectedCount > 0 && (
        <div className="flex items-center justify-between px-4 py-3 text-sm bg-muted/60">
          <span className="text-muted-foreground">
            {selectedCount} signal{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            disabled={deletingBulk}
          >
            {deletingBulk ? "Deleting..." : "Delete Selected"}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="px-4 py-5 sm:px-6">
          <CardTitle className="text-base font-semibold">Recent signals</CardTitle>
          <CardDescription>
            Showing the latest 100 signals from all monitors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSignals ? (
            <div className="py-6 text-sm text-muted-foreground">Loading signals…</div>
          ) : signals.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              No signals yet. Run a monitor to generate your first signal.
            </div>
          ) : (
            <DataTable
              columns={signalsColumns}
              data={signals}
              searchColumn="type"
              searchPlaceholder="Search by type..."
              meta={{
                formatTimestamp,
              }}
              onRowClick={(signal) => onSelectSignal(signal)}
              enableRowSelection={true}
              rowSelection={rowSelection}
              onRowSelectionChange={onRowSelectionChange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedSignal} onOpenChange={(open) => !open && onSelectSignal(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Signal Details</DialogTitle>
            <DialogDescription>
              Complete information about this signal
            </DialogDescription>
          </DialogHeader>

          {selectedSignal && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <p className="text-sm font-medium">{selectedSignal.type || "Untitled signal"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Source</Label>
                  <p className="text-sm">{selectedSignal.source || "-"}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm mt-1">{selectedSignal.description || "-"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Monitor Name</Label>
                  <p className="text-sm">{selectedSignal.metadata.monitorName || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Importance Score</Label>
                  <p className="text-sm font-medium">
                    {typeof selectedSignal.importance === "number"
                      ? `${selectedSignal.importance}/100`
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Occurred At</Label>
                  <p className="text-sm">{formatTimestamp(selectedSignal.occurredAt)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created At</Label>
                  <p className="text-sm">{formatTimestamp(selectedSignal.createdAt)}</p>
                </div>
              </div>

              {selectedSignal.metadata.model && (
                <div>
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  <p className="text-sm">{selectedSignal.metadata.model}</p>
                </div>
              )}

              {selectedSignal.metadata.rawAiOutput && (
                <div>
                  <Label className="text-xs text-muted-foreground">Raw AI Output</Label>
                  <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs font-mono max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words">
                      {selectedSignal.metadata.rawAiOutput}
                    </pre>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Metadata</Label>
                <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs font-mono">
                  <pre className="whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedSignal.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => selectedSignal && onDeleteSignal(selectedSignal.id)}
              disabled={deletingSignal}
            >
              {deletingSignal ? "Deleting..." : "Delete"}
            </Button>
            <Button onClick={() => onSelectSignal(null)} disabled={deletingSignal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Automation settings</CardTitle>
          <CardDescription>
            Global controls for trigger schedules, guardrails, and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We're building the control center next—manual triggers and monitors help us validate the
            signal pipeline in the meantime.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type PeopleViewProps = {
  people: PersonOption[];
  loadingPeople: boolean;
  personForm: PersonFormState;
  personStatus: Status | null;
  personSaving: boolean;
  personDialogOpen: boolean;
  editingPersonId: string | null;
  onUpdateField: <K extends keyof PersonFormState>(key: K, value: PersonFormState[K]) => void;
  onSubmit: (event: React.FormEvent) => void;
  onDialogChange: (open: boolean) => void;
  onEdit: (personId: string) => void;
  onDelete: (personId: string) => void;
};

function PeopleView({
  people,
  loadingPeople,
  personForm,
  personStatus,
  personSaving,
  personDialogOpen,
  editingPersonId,
  onUpdateField,
  onSubmit,
  onDialogChange,
  onEdit,
  onDelete
}: PeopleViewProps) {
  const [peopleDetails, setPeopleDetails] = useState<Person[]>([]);

  useEffect(() => {
    const loadPeopleDetails = async () => {
      try {
        const response = await fetch("/connection-admin/api/people");
        if (!response.ok) return;
        const data = await response.json();
        setPeopleDetails(data.people || []);
      } catch (error) {
        console.error("Failed to load people details:", error);
      }
    };

    if (!loadingPeople) {
      loadPeopleDetails();
    }
  }, [loadingPeople, people]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">People</h1>
          <p className="text-sm text-muted-foreground">
            Manage your contacts and their important dates
          </p>
        </div>
        <Dialog open={personDialogOpen} onOpenChange={onDialogChange}>
          <DialogTrigger asChild>
            <Button size="sm">Add Person</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPersonId ? "Edit Person" : "Add New Person"}</DialogTitle>
              <DialogDescription>
                {editingPersonId
                  ? "Update the person's information and important dates."
                  : "Create a new contact with their relationship and important dates"}
              </DialogDescription>
            </DialogHeader>

            <form id="person-form" className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="person-name">Name</Label>
                <Input
                  id="person-name"
                  placeholder="Mary"
                  value={personForm.name}
                  onChange={event => onUpdateField("name", event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="person-relationship">Relationship</Label>
                <Input
                  id="person-relationship"
                  placeholder="Grandma"
                  value={personForm.relationship}
                  onChange={event => onUpdateField("relationship", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="person-interests">Shared Interests (comma separated)</Label>
                <Input
                  id="person-interests"
                  placeholder="Soccer, Gardening, Cooking"
                  value={personForm.sharedInterests}
                  onChange={event => onUpdateField("sharedInterests", event.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Important Dates</Label>

                {personForm.importantDates.length > 0 && (
                  <div className="space-y-2">
                    {personForm.importantDates.map((date, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-md border p-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{date.label || date.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(date.date).toLocaleDateString()} - {date.type}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newDates = personForm.importantDates.filter((_, i) => i !== index);
                            onUpdateField("importantDates", newDates);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Input
                      id="date-label"
                      placeholder="Label"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                    />
                  </div>
                  <div>
                    <Select
                      onValueChange={(value) => {
                        const input = document.getElementById("date-type-value") as HTMLInputElement;
                        if (input) input.value = value;
                      }}
                    >
                      <SelectTrigger id="date-type">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="birthday">Birthday</SelectItem>
                        <SelectItem value="anniversary">Anniversary</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <input type="hidden" id="date-type-value" />
                  </div>
                  <div>
                    <Input
                      id="date-date"
                      type="date"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const labelInput = document.getElementById("date-label") as HTMLInputElement;
                    const typeInput = document.getElementById("date-type-value") as HTMLInputElement;
                    const dateInput = document.getElementById("date-date") as HTMLInputElement;

                    if (dateInput?.value && typeInput?.value) {
                      const newDate = {
                        type: typeInput.value,
                        date: dateInput.value,
                        label: labelInput?.value || typeInput.value
                      };
                      onUpdateField("importantDates", [...personForm.importantDates, newDate]);

                      // Clear inputs
                      if (labelInput) labelInput.value = "";
                      if (typeInput) typeInput.value = "";
                      if (dateInput) dateInput.value = "";
                    }
                  }}
                >
                  Add Date
                </Button>
              </div>

              {personStatus && (
                <div
                  className={cn(
                    "text-sm font-medium",
                    personStatus.tone === "error" && "text-red-600",
                    personStatus.tone === "success" && "text-green-600"
                  )}
                >
                  {personStatus.message}
                </div>
              )}
            </form>

            <DialogFooter>
              <Button
                type="submit"
                form="person-form"
                disabled={personSaving}
              >
                {personSaving
                  ? (editingPersonId ? "Updating..." : "Creating...")
                  : (editingPersonId ? "Update Person" : "Create Person")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {personStatus && (
        <div
          className={cn(
            "px-4 py-3 text-sm",
            personStatus.tone === "success" && "bg-green-50 text-green-800",
            personStatus.tone === "error" && "bg-red-50 text-red-800",
            personStatus.tone === "info" && "bg-muted/60 text-muted-foreground"
          )}
        >
          {personStatus.message}
        </div>
      )}

      <Card>
        <CardHeader className="px-4 py-5 sm:px-6">
          <CardTitle className="text-base font-semibold">People Directory</CardTitle>
          <CardDescription>
            All your contacts and their important information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPeople ? (
            <div className="py-6 text-sm text-muted-foreground">Loading...</div>
          ) : peopleDetails.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              No people yet. Click "Add Person" to get started.
            </div>
          ) : (
            <DataTable
              columns={peopleColumns}
              data={peopleDetails}
              searchColumn="name"
              searchPlaceholder="Search by name..."
              meta={{
                onEdit,
                onDelete,
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ScheduledTriggersViewProps = {
  triggers: ScheduledTrigger[];
  loadingTriggers: boolean;
  triggerForm: ScheduledTriggerFormState;
  triggerStatus: Status | null;
  triggerSaving: boolean;
  triggerDialogOpen: boolean;
  editingTriggerId: string | null;
  assignments: Assignment[];
  onDialogChange: (open: boolean) => void;
  onUpdateField: <K extends keyof ScheduledTriggerFormState>(key: K, value: ScheduledTriggerFormState[K]) => void;
  onSubmit: (event: React.FormEvent) => void;
  onEdit: (triggerId: string) => void;
  onDelete: (triggerId: string) => void;
};

function ScheduledTriggersView({
  triggers,
  loadingTriggers,
  triggerForm,
  triggerStatus,
  triggerSaving,
  triggerDialogOpen,
  editingTriggerId,
  assignments,
  onDialogChange,
  onUpdateField,
  onSubmit,
  onEdit,
  onDelete
}: ScheduledTriggersViewProps) {
  // Enrich triggers with assignment data for the columns
  const enrichedTriggers = triggers.map(trigger => ({
    ...trigger,
    assignment: assignments.find(a => a.id === trigger.monitorId)
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Scheduled Triggers</h1>
          <p className="text-sm text-muted-foreground">
            Configure automatic schedules for monitors to run periodically.
          </p>
        </div>
        <Dialog open={triggerDialogOpen} onOpenChange={onDialogChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              Create Trigger
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTriggerId ? "Edit trigger" : "Create a trigger"}</DialogTitle>
              <DialogDescription>
                {editingTriggerId
                  ? "Update the trigger schedule and settings."
                  : "Set up a schedule to run a monitor automatically."}
              </DialogDescription>
            </DialogHeader>

            <form id="trigger-form" className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="trigger-monitor">Monitor</Label>
                <Select
                  value={triggerForm.monitorId}
                  onValueChange={value => onUpdateField("monitorId", value)}
                  disabled={assignments.length === 0}
                >
                  <SelectTrigger id="trigger-monitor">
                    <SelectValue placeholder={assignments.length === 0 ? "No monitors available" : "Select monitor…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map(assignment => {
                      const monitor = assignment.monitor;
                      const personLabel = assignment.person
                        ? assignment.person.relationship
                          ? `${assignment.person.name} — ${assignment.person.relationship}`
                          : assignment.person.name
                        : "Unknown person";
                      return (
                        <SelectItem key={assignment.id} value={assignment.id}>
                          {monitor?.name || "Unnamed monitor"} (for {personLabel})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trigger-schedule">Schedule</Label>
                <Input
                  id="trigger-schedule"
                  placeholder="e.g., daily:09:00"
                  value={triggerForm.schedule}
                  onChange={event => onUpdateField("schedule", event.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Format: daily:HH:MM (e.g., daily:09:00 for 9am daily)
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    id="trigger-enabled"
                    type="checkbox"
                    checked={triggerForm.enabled}
                    onChange={event => onUpdateField("enabled", event.target.checked)}
                    className="h-4 w-4 rounded border border-input"
                  />
                  <Label htmlFor="trigger-enabled" className="text-sm font-medium leading-none">
                    Enabled
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  When enabled, this trigger will run automatically on the specified schedule.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={
                    triggerSaving ||
                    !triggerForm.monitorId ||
                    !triggerForm.schedule.trim()
                  }
                >
                  {triggerSaving ? "Saving…" : (editingTriggerId ? "Update Trigger" : "Create Trigger")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {triggerStatus && (
        <div
          className={cn(
            "px-4 py-3 text-sm",
            triggerStatus.tone === "success" && "bg-green-50 text-green-800",
            triggerStatus.tone === "error" && "bg-red-50 text-red-800",
            triggerStatus.tone === "info" && "bg-muted/60 text-muted-foreground"
          )}
        >
          {triggerStatus.message}
        </div>
      )}

      <Card>
        <CardHeader className="px-4 py-5 sm:px-6">
          <CardTitle className="text-base font-semibold">Active Triggers</CardTitle>
          <CardDescription>
            Scheduled runs for your monitors
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTriggers ? (
            <div className="py-6 text-sm text-muted-foreground">Loading triggers…</div>
          ) : triggers.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              No triggers yet. Use "Create Trigger" to schedule your first monitor.
            </div>
          ) : (
            <DataTable
              columns={triggersColumns}
              data={enrichedTriggers}
              searchColumn="schedule"
              searchPlaceholder="Search by schedule..."
              meta={{
                onEdit,
                onDelete,
                assignments,
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
