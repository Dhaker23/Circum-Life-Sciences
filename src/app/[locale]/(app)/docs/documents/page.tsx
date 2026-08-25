"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const DOC_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = { DRAFT: "outline", REVIEW: "secondary", APPROVED: "secondary", EFFECTIVE: "default", SUPERSEDED: "secondary", OBSOLETE: "destructive" };
export default function DocumentsPage() {
  const t = useTranslations("docs");
  const { data, isLoading } = useQuery({ queryKey: ["documents"], queryFn: async () => { const res = await fetch("/api/docs/documents?pageSize=100", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; title: string; documentType: string; version: string; status: string }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.map((d) => (<TableRow key={d.id}><TableCell className="font-mono text-xs">{d.code}</TableCell><TableCell className="text-xs">{d.title}</TableCell><TableCell className="text-xs">{d.documentType}</TableCell><TableCell className="font-mono text-xs">{d.version}</TableCell><TableCell><Badge variant={DOC_VARIANT[d.status] ?? "outline"}>{d.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">No documents found</p>}</CardContent></Card></div>);
}
