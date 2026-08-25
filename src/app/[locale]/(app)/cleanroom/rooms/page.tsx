"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export default function CleanroomPage() {
  const t = useTranslations("cleanroom");
  const { data, isLoading } = useQuery({ queryKey: ["cleanrooms"], queryFn: async () => { const res = await fetch("/api/cleanroom/rooms?pageSize=100", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; name: string; classification: string | null; status: string; _count: { monitoringPoints: number } }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead>Points</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.map((c) => (<TableRow key={c.id}><TableCell className="font-mono text-xs">{c.code}</TableCell><TableCell className="text-xs">{c.name}</TableCell><TableCell className="text-xs">{c.classification ?? "-"}</TableCell><TableCell>{c._count.monitoringPoints}</TableCell><TableCell><Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">No cleanrooms found</p>}</CardContent></Card></div>);
}
