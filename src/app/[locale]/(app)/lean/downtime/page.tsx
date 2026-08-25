"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export default function DowntimePage() {
  const t = useTranslations("lean");
  const { data, isLoading } = useQuery({ queryKey: ["downtime"], queryFn: async () => { const res = await fetch("/api/lean/downtime?pageSize=100", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; downtimeCategory: string; reason: string; durationMinutes: number | null; status: string; equipment: { code: string; name: string } }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("downtime.title")}</h1><p className="text-sm text-muted-foreground">{t("downtime.subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("downtime.title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Code</TableHead><TableHead>Equipment</TableHead><TableHead>Category</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.map((d) => (<TableRow key={d.id}><TableCell className="font-mono text-xs">{d.code}</TableCell><TableCell className="text-xs">{d.equipment.code}</TableCell><TableCell className="text-xs">{d.downtimeCategory}</TableCell><TableCell className="text-xs">{d.durationMinutes ? `${d.durationMinutes}m` : "-"}</TableCell><TableCell><Badge variant={d.status === "OPEN" ? "default" : "secondary"}>{d.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">No downtime events</p>}</CardContent></Card></div>);
}
