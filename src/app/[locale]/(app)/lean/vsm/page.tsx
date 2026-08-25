"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export default function VsmPage() {
  const t = useTranslations("lean");
  const { data, isLoading } = useQuery({ queryKey: ["vsm"], queryFn: async () => { const res = await fetch("/api/lean/vsm", { credentials: "same-origin" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return json.data as Array<{ id: string; code: string; name: string; status: string; totalLeadTimeMinutes: number | null; valueAddedRatio: string | null }>; } });
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("vsm.title")}</h1><p className="text-sm text-muted-foreground">{t("vsm.subtitle")}</p></div><Card><CardHeader><CardTitle className="text-base">{t("vsm.title")}</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data && data.length > 0 ? (<div className="max-h-[32rem] overflow-auto rounded-md border"><Table><TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Lead Time</TableHead><TableHead>VA Ratio</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.map((v) => (<TableRow key={v.id}><TableCell className="font-mono text-xs">{v.code}</TableCell><TableCell className="text-xs">{v.name}</TableCell><TableCell className="text-xs">{v.totalLeadTimeMinutes ? `${v.totalLeadTimeMinutes}m` : "-"}</TableCell><TableCell className="text-xs">{v.valueAddedRatio ? `${(parseFloat(v.valueAddedRatio) * 100).toFixed(1)}%` : "-"}</TableCell><TableCell><Badge variant={v.status === "ACTIVE" ? "default" : "secondary"}>{v.status}</Badge></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-sm text-muted-foreground">No VSMs found</p>}</CardContent></Card></div>);
}
