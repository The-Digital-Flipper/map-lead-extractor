import { useCallback, useEffect, useState } from "react";
import {
  Archive, ArrowLeft, ChevronDown, ChevronUp, Copy, FolderPlus, Loader2,
  Pencil, Plus, RotateCcw, Trash2, X,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type Collection, sanitizeName, filterCollections, sortCollections, reorder, dedupeIds,
} from "@/lib/collections";

type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

interface CollectionLead {
  id: number;
  name: string | null;
  phone: string | null;
  website: string | null;
  emails: string | null;
}

function useCollections(authFetch: AuthFetch, basePath: string) {
  const api = `${basePath}/api/collections`;
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await authFetch(`${api}?archived=1`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setItems(d.collections ?? []);
    } catch {
      setError("Couldn't load collections. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, api]);

  useEffect(() => { load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }, []);

  const create = (name: string) => run(async () => {
    const r = await authFetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (!r.ok) throw new Error();
    await load();
  });
  const update = (id: number, patch: Partial<Pick<Collection, "name" | "color" | "archived">>) => run(async () => {
    const r = await authFetch(`${api}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!r.ok) throw new Error();
    await load();
  });
  const duplicate = (id: number) => run(async () => {
    const r = await authFetch(`${api}/${id}/duplicate`, { method: "POST" });
    if (!r.ok) throw new Error();
    await load();
  });
  const remove = (id: number) => run(async () => {
    const r = await authFetch(`${api}/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error();
    await load();
  });
  const persistOrder = (order: number[]) => run(async () => {
    const r = await authFetch(`${api}/reorder`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) });
    if (!r.ok) throw new Error();
  });
  const addLeads = (id: number, leadIds: number[]) => run(async () => {
    const r = await authFetch(`${api}/${id}/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds }) });
    if (!r.ok) throw new Error();
    await load();
  });
  const removeLeads = (id: number, leadIds: number[]) => run(async () => {
    const r = await authFetch(`${api}/${id}/leads`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds }) });
    if (!r.ok) throw new Error();
    await load();
  });

  return { items, setItems, loading, error, busy, load, create, update, duplicate, remove, persistOrder, addLeads, removeLeads };
}

export function CollectionsManager({
  open, onOpenChange, authFetch, basePath, selectedLeadIds, onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  authFetch: AuthFetch;
  basePath: string;
  selectedLeadIds: number[];
  onAdded?: (collectionName: string, count: number) => void;
}) {
  const c = useCollections(authFetch, basePath);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Collection | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const selected = dedupeIds(selectedLeadIds);
  const visible = sortCollections(filterCollections(c.items, query));

  function submitNew() {
    const name = sanitizeName(newName);
    if (!name) return;
    c.create(name);
    setNewName("");
  }
  function submitRename(id: number) {
    const name = sanitizeName(editName);
    if (name) c.update(id, { name });
    setEditingId(null);
  }
  function moveBy(index: number, dir: -1 | 1) {
    const ordered = visible.map((x) => x.id);
    const next = reorder(ordered, index, dir);
    if (next === ordered) return;
    c.setItems((prev) => prev.map((x) => { const i = next.indexOf(x.id); return i >= 0 ? { ...x, sortOrder: i } : x; }));
    c.persistOrder(next);
  }
  async function addSelectedTo(col: Collection) {
    if (!selected.length) return;
    await c.addLeads(col.id, selected);
    onAdded?.(col.name, selected.length);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-background border-border flex flex-col p-0">
        <SheetHeader className="px-6 h-16 border-b border-border flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="font-display font-bold text-lg flex items-center gap-2">
            {openId !== null && (
              <button aria-label="Back to collections" onClick={() => setOpenId(null)} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {openId !== null ? c.items.find((x) => x.id === openId)?.name ?? "Collection" : "Collections"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {c.error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300 flex items-center justify-between" role="alert">
              <span>{c.error}</span>
              <button onClick={() => c.load()} className="inline-flex items-center gap-1 text-red-200 hover:underline"><RotateCcw className="w-4 h-4" /> Retry</button>
            </div>
          )}

          {openId !== null ? (
            <CollectionDetail
              collection={c.items.find((x) => x.id === openId)}
              authFetch={authFetch}
              basePath={basePath}
              onRemoveLeads={(ids) => openId !== null && c.removeLeads(openId, ids)}
            />
          ) : (
            <>
              {selected.length > 0 && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                  <span className="text-foreground font-medium">{selected.length} lead{selected.length > 1 ? "s" : ""} selected.</span>{" "}
                  <span className="text-muted-foreground">Choose a collection's “Add” button to save them.</span>
                </div>
              )}

              {/* Create */}
              <form onSubmit={(e) => { e.preventDefault(); submitNew(); }} className="flex gap-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New collection name" aria-label="New collection name" maxLength={80} className="h-10" data-testid="input-new-collection" />
                <Button type="submit" disabled={!sanitizeName(newName) || c.busy} className="font-bold shrink-0" data-testid="btn-create-collection">
                  <FolderPlus className="w-4 h-4 mr-1" /> Create
                </Button>
              </form>

              {/* Search */}
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search collections…" aria-label="Search collections" className="h-10" data-testid="input-search-collections" />

              {/* States */}
              {c.loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : visible.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FolderPlus className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium text-foreground mb-1">{query ? "No matches" : "No collections yet"}</p>
                  <p className="text-sm">{query ? "Try a different search." : "Create your first collection to organize leads."}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {visible.map((col, i) => (
                    <li key={col.id} className={`rounded-xl border border-border bg-card/40 p-3 ${col.archived ? "opacity-60" : ""}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <button aria-label={`Move ${col.name} up`} disabled={i === 0 || c.busy} onClick={() => moveBy(i, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                          <button aria-label={`Move ${col.name} down`} disabled={i === visible.length - 1 || c.busy} onClick={() => moveBy(i, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                        </div>

                        {editingId === col.id ? (
                          <form onSubmit={(e) => { e.preventDefault(); submitRename(col.id); }} className="flex-1 flex gap-2">
                            <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Rename collection" maxLength={80} className="h-9" />
                            <Button type="submit" size="sm" disabled={c.busy}>Save</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                          </form>
                        ) : (
                          <>
                            <button className="flex-1 text-left" onClick={() => setOpenId(col.id)} data-testid={`open-collection-${col.id}`}>
                              <span className="font-medium text-foreground">{col.name}</span>
                              {col.archived && <span className="ml-2 text-xs text-muted-foreground">(archived)</span>}
                            </button>
                            <Badge variant="secondary" className="shrink-0">{col.leadCount}</Badge>
                          </>
                        )}
                      </div>

                      {editingId !== col.id && (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          {selected.length > 0 && !col.archived && (
                            <Button size="sm" className="h-8 font-semibold" disabled={c.busy} onClick={() => addSelectedTo(col)} data-testid={`add-to-${col.id}`}>
                              <Plus className="w-4 h-4 mr-1" /> Add {selected.length}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8" disabled={c.busy} onClick={() => { setEditingId(col.id); setEditName(col.name); }}><Pencil className="w-4 h-4 mr-1" /> Rename</Button>
                          <Button size="sm" variant="ghost" className="h-8" disabled={c.busy} onClick={() => c.duplicate(col.id)}><Copy className="w-4 h-4 mr-1" /> Duplicate</Button>
                          <Button size="sm" variant="ghost" className="h-8" disabled={c.busy} onClick={() => c.update(col.id, { archived: !col.archived })}>
                            {col.archived ? <><RotateCcw className="w-4 h-4 mr-1" /> Unarchive</> : <><Archive className="w-4 h-4 mr-1" /> Archive</>}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-red-400 hover:text-red-300" disabled={c.busy} onClick={() => setConfirmDelete(col)}><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </SheetContent>

      {/* Destructive-action confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the collection and its {confirmDelete?.leadCount ?? 0} membership(s). The leads themselves are not deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500"
              onClick={() => { if (confirmDelete) c.remove(confirmDelete.id); setConfirmDelete(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function CollectionDetail({
  collection, authFetch, basePath, onRemoveLeads,
}: {
  collection: Collection | undefined;
  authFetch: AuthFetch;
  basePath: string;
  onRemoveLeads: (ids: number[]) => void;
}) {
  const [leads, setLeads] = useState<CollectionLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!collection) return;
    setLoading(true); setError(null);
    try {
      const r = await authFetch(`${basePath}/api/collections/${collection.id}/leads?limit=200`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setLeads(d.leads ?? []);
    } catch {
      setError("Couldn't load this collection's leads.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, basePath, collection]);

  useEffect(() => { load(); }, [load]);

  if (!collection) return null;

  function handleRemove(id: number) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    onRemoveLeads([id]);
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error) return <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300" role="alert">{error}</div>;
  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="font-medium text-foreground mb-1">No leads in this collection</p>
        <p className="text-sm">Select leads in the dashboard and use “Add” to fill it.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {leads.map((l) => (
        <li key={l.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{l.name ?? "Unnamed business"}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[l.phone, l.emails, l.website].filter(Boolean).join(" · ") || "No contact info"}
            </div>
          </div>
          <button aria-label={`Remove ${l.name ?? "lead"} from collection`} onClick={() => handleRemove(l.id)} className="text-muted-foreground hover:text-red-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
