import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Check,
  ArrowLeft,
  FileText
} from "lucide-react";

// Types
type OnboardingPillar = {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  color: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type OnboardingPrinciple = {
  id: string;
  pillarId: string;
  text: string;
  order: number;
  isActive: boolean;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
};

type Status = {
  tone: "success" | "error" | "info";
  message: string;
};

const API_BASE = "/api/onboarding-content";

export function ContentView() {
  // Navigation state
  const [selectedPillar, setSelectedPillar] = useState<OnboardingPillar | null>(null);

  // Data state
  const [pillars, setPillars] = useState<OnboardingPillar[]>([]);
  const [principles, setPrinciples] = useState<OnboardingPrinciple[]>([]);

  // Loading state
  const [loadingPillars, setLoadingPillars] = useState(true);
  const [loadingPrinciples, setLoadingPrinciples] = useState(false);

  // Dialog state
  const [pillarDialogOpen, setPillarDialogOpen] = useState(false);
  const [principleDialogOpen, setPrincipleDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);

  // Extract state
  const [extractText, setExtractText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<{
    pillars: number;
    principles: number;
    items: {
      pillars: OnboardingPillar[];
      principles: OnboardingPrinciple[];
    };
  } | null>(null);

  // Form state
  const [editingPillar, setEditingPillar] = useState<OnboardingPillar | null>(null);
  const [editingPrinciple, setEditingPrinciple] = useState<OnboardingPrinciple | null>(null);

  const [pillarForm, setPillarForm] = useState({ title: "", description: "", color: "#6366f1" });
  const [principleForm, setPrincipleForm] = useState({ text: "" });

  // Generation state
  const [generationType, setGenerationType] = useState<"pillars" | "principles">("pillars");
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  // Status
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);

  // Load pillars
  const loadPillars = useCallback(async () => {
    setLoadingPillars(true);
    try {
      const response = await fetch(`${API_BASE}/pillars?includeInactive=true`);
      if (!response.ok) throw new Error("Failed to load pillars");
      const data = await response.json();
      setPillars(data.pillars || []);
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load pillars"
      });
    } finally {
      setLoadingPillars(false);
    }
  }, []);

  // Load principles for a pillar
  const loadPrinciples = useCallback(async (pillarId: string) => {
    setLoadingPrinciples(true);
    try {
      const response = await fetch(`${API_BASE}/principles?pillarId=${pillarId}&includeInactive=true&includeDrafts=true`);
      if (!response.ok) throw new Error("Failed to load principles");
      const data = await response.json();
      setPrinciples(data.principles || []);
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load principles"
      });
    } finally {
      setLoadingPrinciples(false);
    }
  }, []);

  useEffect(() => {
    loadPillars();
  }, [loadPillars]);

  useEffect(() => {
    if (selectedPillar) {
      loadPrinciples(selectedPillar.id);
    }
  }, [selectedPillar, loadPrinciples]);

  // Pillar CRUD
  const handleSavePillar = async () => {
    if (!pillarForm.title.trim()) {
      setStatus({ tone: "error", message: "Title is required" });
      return;
    }

    setSaving(true);
    try {
      const url = editingPillar ? `${API_BASE}/pillars/${editingPillar.id}` : `${API_BASE}/pillars`;
      const method = editingPillar ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pillarForm)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save pillar");
      }

      setStatus({ tone: "success", message: `Pillar ${editingPillar ? "updated" : "created"}` });
      setPillarDialogOpen(false);
      setPillarForm({ title: "", description: "", color: "#6366f1" });
      setEditingPillar(null);
      loadPillars();
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save pillar"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePillar = async (pillar: OnboardingPillar) => {
    if (!confirm(`Delete "${pillar.title}" and all its principles?`)) return;

    try {
      const response = await fetch(`${API_BASE}/pillars/${pillar.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete pillar");

      setStatus({ tone: "success", message: "Pillar deleted" });
      if (selectedPillar?.id === pillar.id) {
        setSelectedPillar(null);
      }
      loadPillars();
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to delete pillar"
      });
    }
  };

  // Principle CRUD
  const handleSavePrinciple = async () => {
    if (!principleForm.text.trim()) {
      setStatus({ tone: "error", message: "Text is required" });
      return;
    }

    setSaving(true);
    try {
      const url = editingPrinciple ? `${API_BASE}/principles/${editingPrinciple.id}` : `${API_BASE}/principles`;
      const method = editingPrinciple ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...principleForm,
          pillarId: selectedPillar?.id
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save principle");
      }

      setStatus({ tone: "success", message: `Principle ${editingPrinciple ? "updated" : "created"}` });
      setPrincipleDialogOpen(false);
      setPrincipleForm({ text: "" });
      setEditingPrinciple(null);
      if (selectedPillar) loadPrinciples(selectedPillar.id);
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save principle"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrinciple = async (principle: OnboardingPrinciple) => {
    if (!confirm("Delete this principle?")) return;

    try {
      const response = await fetch(`${API_BASE}/principles/${principle.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete principle");

      setStatus({ tone: "success", message: "Principle deleted" });
      if (selectedPillar) loadPrinciples(selectedPillar.id);
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to delete principle"
      });
    }
  };

  const handleApprovePrinciple = async (principle: OnboardingPrinciple) => {
    try {
      const response = await fetch(`${API_BASE}/principles/${principle.id}/approve`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to approve principle");

      setStatus({ tone: "success", message: "Principle approved" });
      if (selectedPillar) loadPrinciples(selectedPillar.id);
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to approve principle"
      });
    }
  };

  // LLM Generation
  const handleGenerate = async () => {
    setGenerating(true);
    setSuggestions([]);
    setSelectedSuggestions(new Set());

    try {
      let url = "";
      let body: Record<string, unknown> = {};

      if (generationType === "pillars") {
        url = `${API_BASE}/generate/pillars`;
        body = { count: 5 };
      } else if (generationType === "principles") {
        url = `${API_BASE}/generate/principles`;
        body = { pillarId: selectedPillar?.id, count: 5 };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate content");
      }

      const data = await response.json();
      
      if (generationType === "pillars") {
        setSuggestions(data.suggestions.map((s: { title: string }) => s.title));
      } else {
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to generate content"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAddSelectedSuggestions = async () => {
    if (selectedSuggestions.size === 0) return;

    setSaving(true);
    try {
      const selected = Array.from(selectedSuggestions).map(i => suggestions[i]);

      if (generationType === "pillars") {
        for (const title of selected) {
          await fetch(`${API_BASE}/pillars`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description: "" })
          });
        }
        loadPillars();
      } else if (generationType === "principles" && selectedPillar) {
        await fetch(`${API_BASE}/principles/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            pillarId: selectedPillar.id, 
            principles: selected,
            isDraft: true 
          })
        });
        loadPrinciples(selectedPillar.id);
      }

      setStatus({ tone: "success", message: `Added ${selectedSuggestions.size} item(s) as drafts` });
      setGenerateDialogOpen(false);
      setSuggestions([]);
      setSelectedSuggestions(new Set());
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to add suggestions"
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  // Extract content from text
  const handleExtract = async () => {
    if (!extractText.trim()) {
      setStatus({ tone: "error", message: "Please paste some text to extract from" });
      return;
    }

    setExtracting(true);
    setExtractResult(null);

    try {
      const response = await fetch(`${API_BASE}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractText })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to extract content");
      }

      const data = await response.json();
      setExtractResult({
        pillars: data.created.pillars,
        principles: data.created.principles,
        items: data.items
      });

      // Reload data
      loadPillars();

      setStatus({ 
        tone: "success", 
        message: `Extracted ${data.created.pillars} pillars, ${data.created.principles} principles` 
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to extract content"
      });
    } finally {
      setExtracting(false);
    }
  };

  // Breadcrumb navigation
  const breadcrumbs = [];
  breadcrumbs.push({ label: "Pillars", onClick: () => { setSelectedPillar(null); } });
  if (selectedPillar) {
    breadcrumbs.push({ label: selectedPillar.title, onClick: () => {} });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-4 w-4" />}
                <button
                  onClick={crumb.onClick}
                  className={cn(
                    "hover:text-foreground transition-colors",
                    i === breadcrumbs.length - 1 && "text-foreground font-medium"
                  )}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Onboarding Content
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage pillars and principles for the onboarding flow
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setExtractText("");
              setExtractResult(null);
              setExtractDialogOpen(true);
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Extract from Text
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (selectedPillar) {
                setGenerationType("principles");
              } else {
                setGenerationType("pillars");
              }
              setSuggestions([]);
              setSelectedSuggestions(new Set());
              setGenerateDialogOpen(true);
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate with AI
          </Button>
          {!selectedPillar && (
            <Button size="sm" onClick={() => setPillarDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pillar
            </Button>
          )}
          {selectedPillar && (
            <Button size="sm" onClick={() => setPrincipleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Principle
            </Button>
          )}
        </div>
      </header>

      {status && (
        <div
          className={cn(
            "px-4 py-3 text-sm rounded-md",
            status.tone === "success" && "bg-green-50 text-green-800",
            status.tone === "error" && "bg-red-50 text-red-800",
            status.tone === "info" && "bg-muted/60 text-muted-foreground"
          )}
        >
          {status.message}
        </div>
      )}

      {/* Back button when viewing principles */}
      {selectedPillar && (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setSelectedPillar(null)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pillars
        </Button>
      )}

      {/* Pillars List */}
      {!selectedPillar && (
        <Card>
          <CardHeader>
            <CardTitle>Pillars</CardTitle>
            <CardDescription>
              Top-level life domains users can choose from (e.g., Finances, Family, Faith)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPillars ? (
              <div className="py-6 text-sm text-muted-foreground">Loading pillars...</div>
            ) : pillars.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">
                No pillars yet. Click "Add Pillar" or "Generate with AI" to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {pillars.map(pillar => (
                  <div
                    key={pillar.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors",
                      "hover:bg-muted/50",
                      !pillar.isActive && "opacity-50"
                    )}
                    onClick={() => setSelectedPillar(pillar)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: pillar.color }}
                      />
                      <div>
                        <div className="font-medium">{pillar.title}</div>
                        {pillar.description && (
                          <div className="text-sm text-muted-foreground">{pillar.description}</div>
                        )}
                      </div>
                      {!pillar.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPillar(pillar);
                          setPillarForm({
                            title: pillar.title,
                            description: pillar.description,
                            color: pillar.color
                          });
                          setPillarDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePillar(pillar);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Principles List */}
      {selectedPillar && (
        <Card>
          <CardHeader>
            <CardTitle>Principles for "{selectedPillar.title}"</CardTitle>
            <CardDescription>
              Specific statements users can select to describe how they'll live this out
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPrinciples ? (
              <div className="py-6 text-sm text-muted-foreground">Loading principles...</div>
            ) : principles.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">
                No principles yet. Click "Add Principle" or "Generate with AI" to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {principles.map(principle => (
                  <div
                    key={principle.id}
                    className={cn(
                      "flex items-start justify-between p-4 rounded-lg border",
                      !principle.isActive && "opacity-50",
                      principle.isDraft && "border-amber-300 bg-amber-50/50"
                    )}
                  >
                    <div className="flex-1 mr-4">
                      <div className="text-sm">{principle.text}</div>
                      <div className="flex gap-2 mt-2">
                        {!principle.isActive && <Badge variant="secondary">Inactive</Badge>}
                        {principle.isDraft && <Badge variant="outline" className="border-amber-500 text-amber-700">Draft</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {principle.isDraft && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => handleApprovePrinciple(principle)}
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingPrinciple(principle);
                          setPrincipleForm({ text: principle.text });
                          setPrincipleDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeletePrinciple(principle)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pillar Dialog */}
      <Dialog open={pillarDialogOpen} onOpenChange={(open) => {
        setPillarDialogOpen(open);
        if (!open) {
          setEditingPillar(null);
          setPillarForm({ title: "", description: "", color: "#6366f1" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPillar ? "Edit Pillar" : "Add Pillar"}</DialogTitle>
            <DialogDescription>
              {editingPillar ? "Update this pillar's details" : "Create a new top-level life domain"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pillar-title">Title</Label>
              <Input
                id="pillar-title"
                placeholder="e.g., Finances"
                value={pillarForm.title}
                onChange={(e) => setPillarForm({ ...pillarForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pillar-description">Description (optional)</Label>
              <Input
                id="pillar-description"
                placeholder="Brief description"
                value={pillarForm.description}
                onChange={(e) => setPillarForm({ ...pillarForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pillar-color">Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  id="pillar-color"
                  value={pillarForm.color}
                  onChange={(e) => setPillarForm({ ...pillarForm, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={pillarForm.color}
                  onChange={(e) => setPillarForm({ ...pillarForm, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPillarDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePillar} disabled={saving}>
              {saving ? "Saving..." : (editingPillar ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Principle Dialog */}
      <Dialog open={principleDialogOpen} onOpenChange={(open) => {
        setPrincipleDialogOpen(open);
        if (!open) {
          setEditingPrinciple(null);
          setPrincipleForm({ text: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPrinciple ? "Edit Principle" : "Add Principle"}</DialogTitle>
            <DialogDescription>
              {editingPrinciple ? "Update this principle" : "Add a principle statement"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="principle-text">Principle Text</Label>
              <Textarea
                id="principle-text"
                placeholder="e.g., Track every dollar, every week. No mystery money—I know where it all goes."
                value={principleForm.text}
                onChange={(e) => setPrincipleForm({ text: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrincipleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePrinciple} disabled={saving}>
              {saving ? "Saving..." : (editingPrinciple ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract Dialog */}
      <Dialog open={extractDialogOpen} onOpenChange={(open) => {
        setExtractDialogOpen(open);
        if (!open) {
          setExtractText("");
          setExtractResult(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <FileText className="h-5 w-5 inline mr-2" />
              Extract Content from Text
            </DialogTitle>
            <DialogDescription>
              Paste text (articles, notes, quotes) and AI will extract pillars and principles.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="extract-text">Paste your text here</Label>
              <Textarea
                id="extract-text"
                placeholder="Paste an article, quotes, notes, or any text you want to extract wisdom from..."
                value={extractText}
                onChange={(e) => setExtractText(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The AI will analyze the text and create pillars (life domains) 
                and principles (actionable "I" statements) as drafts for your review.
              </p>
            </div>

            {extracting && (
              <div className="text-center py-8 border rounded-lg bg-muted/30">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Analyzing text and extracting content...</p>
                <p className="text-xs text-muted-foreground mt-2">This may take a moment...</p>
              </div>
            )}

            {extractResult && (
              <div className="border rounded-lg p-4 bg-green-50/50">
                <h4 className="font-medium text-green-800 mb-3">✓ Extraction Complete</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 bg-white rounded border">
                    <div className="text-2xl font-bold text-primary">{extractResult.pillars}</div>
                    <div className="text-xs text-muted-foreground">Pillars Created</div>
                  </div>
                  <div className="p-3 bg-white rounded border">
                    <div className="text-2xl font-bold text-primary">{extractResult.principles}</div>
                    <div className="text-xs text-muted-foreground">Principles (Drafts)</div>
                  </div>
                </div>
                
                {extractResult.items.pillars.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium mb-2">New Pillars:</h5>
                    <div className="flex flex-wrap gap-2">
                      {extractResult.items.pillars.map(p => (
                        <Badge key={p.id} variant="secondary">{p.title}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {extractResult.items.principles.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium mb-2">New Principles (as drafts):</h5>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {extractResult.items.principles.map(p => (
                        <div key={p.id} className="text-sm p-2 bg-white rounded border">
                          {p.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtractDialogOpen(false)}>
              {extractResult ? "Done" : "Cancel"}
            </Button>
            {!extractResult && (
              <Button onClick={handleExtract} disabled={extracting || !extractText.trim()}>
                {extracting ? "Extracting..." : "Extract Content"}
              </Button>
            )}
            {extractResult && (
              <Button onClick={() => {
                setExtractText("");
                setExtractResult(null);
              }}>
                Extract More
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <Sparkles className="h-5 w-5 inline mr-2" />
              Generate {generationType === "pillars" ? "Pillars" : "Principles"}
            </DialogTitle>
            <DialogDescription>
              Use AI to generate draft content. Review and select which ones to add.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {suggestions.length === 0 && !generating && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Click "Generate" to create AI-suggested {generationType}
                  {generationType === "principles" && selectedPillar && ` for "${selectedPillar.title}"`}
                </p>
                <Button onClick={handleGenerate}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
            )}

            {generating && (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Generating suggestions...</p>
              </div>
            )}

            {suggestions.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Select the suggestions you want to add as drafts:
                </p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {suggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedSuggestions.has(i) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                      )}
                      onClick={() => toggleSuggestion(i)}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5",
                        selectedSuggestions.has(i) ? "bg-primary border-primary" : "border-muted-foreground"
                      )}>
                        {selectedSuggestions.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm">{suggestion}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                    Regenerate
                  </Button>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
            {suggestions.length > 0 && (
              <Button 
                onClick={handleAddSelectedSuggestions} 
                disabled={selectedSuggestions.size === 0 || saving}
              >
                {saving ? "Adding..." : `Add ${selectedSuggestions.size} as Drafts`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
